/**
 * instance
 */

function createComponentInstance(vnode, parent, suspense) {
    const type = vnode.type;
    // inherit parent app context - or - if root, adopt from root vnode
    const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
    const instance = {
        uid: uid$2++,
        vnode,
        type,
        parent,
        appContext,
        root: null,
        next: null,
        subTree: null,
        update: null,
        render: null,
        proxy: null,
        withProxy: null,
        effects: null,
        provides: parent ? parent.provides : Object.create(appContext.provides),
        accessCache: null,
        renderCache: [],
        // local resovled assets
        components: null,
        directives: null,
        // resolved props and emits options
        propsOptions: normalizePropsOptions(type, appContext),
        emitsOptions: normalizeEmitsOptions(type, appContext),
        // emit
        emit: null,
        emitted: null,
        // state
        ctx: EMPTY_OBJ,
        data: EMPTY_OBJ,
        props: EMPTY_OBJ,
        attrs: EMPTY_OBJ,
        slots: EMPTY_OBJ,
        refs: EMPTY_OBJ,
        setupState: EMPTY_OBJ,
        setupContext: null,
        // suspense related
        suspense,
        suspenseId: suspense ? suspense.pendingId : 0,
        asyncDep: null,
        asyncResolved: false,
        // lifecycle hooks
        // not using enums here because it results in computed properties
        isMounted: false,
        isUnmounted: false,
        isDeactivated: false,
        bc: null,
        c: null,
        bm: null,
        m: null,
        bu: null,
        u: null,
        um: null,
        bum: null,
        da: null,
        a: null,
        rtg: null,
        rtc: null,
        ec: null
    };
    {
        instance.ctx = createRenderContext(instance);
    }
    instance.root = parent ? parent.root : instance;
    instance.emit = emit.bind(null, instance);
    {
        devtoolsComponentAdded(instance);
    }
    return instance;
}

        const publicPropertiesMap = extend(Object.create(null), {
            $: i => i,
            $el: i => i.vnode.el,
            $data: i => i.data,
            $props: i => ( shallowReadonly(i.props) ),
            $attrs: i => ( shallowReadonly(i.attrs) ),
            $slots: i => ( shallowReadonly(i.slots) ),
            $refs: i => ( shallowReadonly(i.refs) ),
            $parent: i => i.parent && i.parent.proxy,
            $root: i => i.root && i.root.proxy,
            $emit: i => i.emit,
            $options: i => ( resolveMergedOptions(i) ),
            $forceUpdate: i => () => queueJob(i.update),
            $nextTick: () => nextTick,
            $watch: i => ( instanceWatch.bind(i) )
        });
        // In dev mode, the proxy target exposes the same properties as seen on `this`
        // for easier console inspection. In prod mode it will be an empty object so
        // these properties definitions can be skipped.
        function createRenderContext(instance) {
            const target = {};
            // expose internal instance for proxy handlers
            Object.defineProperty(target, `_`, {
                configurable: true,
                enumerable: false,
                get: () => instance
            });
            // expose public properties
            Object.keys(publicPropertiesMap).forEach(key => {
                Object.defineProperty(target, key, {
                    configurable: true,
                    enumerable: false,
                    get: () => publicPropertiesMap[key](instance),
                    // intercepted by the proxy so no need for implementation,
                    // but needed to prevent set errors
                    set: NOOP
                });
            });
            // expose global properties
            const { globalProperties } = instance.appContext.config;
            Object.keys(globalProperties).forEach(key => {
                Object.defineProperty(target, key, {
                    configurable: true,
                    enumerable: false,
                    get: () => globalProperties[key],
                    set: NOOP
                });
            });
            return target;
        }


function setupComponent(instance, isSSR = false) {
    isInSSRComponentSetup = isSSR;
    const { props, children, shapeFlag } = instance.vnode;
    const isStateful = shapeFlag & 4 /* STATEFUL_COMPONENT */;
    initProps(instance, props, isStateful, isSSR);
    initSlots(instance, children);
    const setupResult = isStateful
        ? setupStatefulComponent(instance, isSSR)
        : undefined;
    isInSSRComponentSetup = false;
    return setupResult;
}

function setupStatefulComponent(instance, isSSR) {
    const Component = instance.type;
    {
        if (Component.name) {
            validateComponentName(Component.name, instance.appContext.config);
        }
        if (Component.components) {
            const names = Object.keys(Component.components);
            for (let i = 0; i < names.length; i++) {
                validateComponentName(names[i], instance.appContext.config);
            }
        }
        if (Component.directives) {
            const names = Object.keys(Component.directives);
            for (let i = 0; i < names.length; i++) {
                validateDirectiveName(names[i]);
            }
        }
    }
    // 0. create render proxy property access cache
    instance.accessCache = {};
    // 1. create public instance / render proxy
    // also mark it raw so it's never observed
    instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
    {
        exposePropsOnRenderContext(instance);
    }
    // 2. call setup()
    const { setup } = Component;
    if (setup) {
        const setupContext = (instance.setupContext =
            setup.length > 1 ? createSetupContext(instance) : null);
        currentInstance = instance;
        pauseTracking();
        const setupResult = callWithErrorHandling(setup, instance, 0 /* SETUP_FUNCTION */, [ shallowReadonly(instance.props) , setupContext]);
        resetTracking();
        currentInstance = null;
        if (isPromise(setupResult)) {
            if (isSSR) {
                // return the promise so server-renderer can wait on it
                return setupResult.then((resolvedResult) => {
                    handleSetupResult(instance, resolvedResult);
                });
            }
            else {
                // async setup returned Promise.
                // bail here and wait for re-entry.
                instance.asyncDep = setupResult;
            }
        }
        else {
            handleSetupResult(instance, setupResult);
        }
    }
    else {
        finishComponentSetup(instance);
    }
}

function createSetupContext(instance) {
    {
        // We use getters in dev in case libs like test-utils overwrite instance
        // properties (overwrites should not be done in prod)
        return Object.freeze({
            get attrs() {
                return new Proxy(instance.attrs, attrHandlers);
            },
            get slots() {
                return shallowReadonly(instance.slots);
            },
            get emit() {
                return (event, ...args) => instance.emit(event, ...args);
            }
        });
    }
}
        const attrHandlers = {
            get: (target, key) => {
                {
                    markAttrsAccessed();
                }
                return target[key];
            },
            set: () => {
                warn(`setupContext.attrs is readonly.`);
                return false;
            },
            deleteProperty: () => {
                warn(`setupContext.attrs is readonly.`);
                return false;
            }
        };

function handleSetupResult(instance, setupResult, isSSR) {
    if (isFunction(setupResult)) {
        // setup returned an inline render function
        instance.render = setupResult;
    }
    else if (isObject(setupResult)) {
        if ( isVNode(setupResult)) {
            warn(`setup() should not return VNodes directly - ` +
                `return a render function instead.`);
        }
        // setup returned bindings.
        // assuming a render function compiled from template is present.
        {
            instance.devtoolsRawSetupState = setupResult;
        }
        instance.setupState = proxyRefs(setupResult);
        {
            exposeSetupStateOnRenderContext(instance);
        }
    }
    else if ( setupResult !== undefined) {
        warn(`setup() should return an object. Received: ${setupResult === null ? 'null' : typeof setupResult}`);
    }
    finishComponentSetup(instance);
}
        function proxyRefs(objectWithRefs) {
            return isReactive(objectWithRefs)
                ? objectWithRefs
                : new Proxy(objectWithRefs, shallowUnwrapHandlers);
        }
        const shallowUnwrapHandlers = {
            get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
            set: (target, key, value, receiver) => {
                const oldValue = target[key];
                if (isRef(oldValue) && !isRef(value)) {
                    oldValue.value = value;
                    return true;
                }
                else {
                    return Reflect.set(target, key, value, receiver);
                }
            }
        };
        // dev only
        function exposeSetupStateOnRenderContext(instance) {
            const { ctx, setupState } = instance;
            Object.keys(toRaw(setupState)).forEach(key => {
                if (key[0] === '$' || key[0] === '_') {
                    warn(`setup() return property ${JSON.stringify(key)} should not start with "$" or "_" ` +
                        `which are reserved prefixes for Vue internals.`);
                    return;
                }
                Object.defineProperty(ctx, key, {
                    enumerable: true,
                    configurable: true,
                    get: () => setupState[key],
                    set: NOOP
                });
            });
        }

function finishComponentSetup(instance, isSSR) {
    const Component = instance.type;
    // template / render function normalization
    if (!instance.render) {
        // could be set from setup()
        if (compile && Component.template && !Component.render) {
            {
                startMeasure(instance, `compile`);
            }
            Component.render = compile(Component.template, {
                isCustomElement: instance.appContext.config.isCustomElement,
                delimiters: Component.delimiters
            });
            {
                endMeasure(instance, `compile`);
            }
        }
        instance.render = (Component.render || NOOP);
        // for runtime-compiled render functions using `with` blocks, the render
        // proxy used needs a different `has` handler which is more performant and
        // also only allows a whitelist of globals to fallthrough.
        if (instance.render._rc) {
            instance.withProxy = new Proxy(instance.ctx, RuntimeCompiledPublicInstanceProxyHandlers);
        }
    }
    // support for 2.x options
    {
        currentInstance = instance;
        applyOptions(instance, Component);
        currentInstance = null;
    }
    // warn missing template/render
    if ( !Component.render && instance.render === NOOP) {
        /* istanbul ignore if */
        if (!compile && Component.template) {
            warn(`Component provided template option but ` +
                `runtime compilation is not supported in this build of Vue.` +
                (  ` Use "vue.esm-browser.js" instead.`
                        ) /* should not happen */);
        }
        else {
            warn(`Component is missing template or render function.`);
        }
    }
}