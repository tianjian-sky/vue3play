const createApp = ((...args) => {}) //入口 8942

function createApp(rootComponent, rootProps = null) {
    if (rootProps != null && !isObject(rootProps)) {
         warn(`root props passed to app.mount() must be an object.`);
        rootProps = null;
    }
    const context = createAppContext();
    const installedPlugins = new Set();
    let isMounted = false;
    const app = (context.app = {
        _uid: uid$1++,
        _component: rootComponent,
        _props: rootProps,
        _container: null,
        _context: context,
        version,
        get config() {
            return context.config;
        },
        set config(v) {
            {
                warn(`app.config cannot be replaced. Modify individual options instead.`);
            }
        },
        use(plugin, ...options) {
            if (installedPlugins.has(plugin)) {
                 warn(`Plugin has already been applied to target app.`);
            }
            else if (plugin && isFunction(plugin.install)) {
                installedPlugins.add(plugin);
                plugin.install(app, ...options);
            }
            else if (isFunction(plugin)) {
                installedPlugins.add(plugin);
                plugin(app, ...options);
            }
            else {
                warn(`A plugin must either be a function or an object with an "install" ` +
                    `function.`);
            }
            return app;
        },
        mixin(mixin) {
            {
                if (!context.mixins.includes(mixin)) {
                    context.mixins.push(mixin);
                }
                else {
                    warn('Mixin has already been applied to target app' +
                        (mixin.name ? `: ${mixin.name}` : ''));
                }
            }
            return app;
        },
        component(name, component) {
            {
                validateComponentName(name, context.config);
            }
            if (!component) {
                return context.components[name];
            }
            if ( context.components[name]) {
                warn(`Component "${name}" has already been registered in target app.`);
            }
            context.components[name] = component;
            return app;
        },
        directive(name, directive) {
            {
                validateDirectiveName(name);
            }
            if (!directive) {
                return context.directives[name];
            }
            if ( context.directives[name]) {
                warn(`Directive "${name}" has already been registered in target app.`);
            }
            context.directives[name] = directive;
            return app;
        },
        mount(rootContainer, isHydrate) {
            if (!isMounted) {
                const vnode = createVNode(rootComponent, rootProps);
                // store app context on the root VNode.
                // this will be set on the root instance on initial mount.
                vnode.appContext = context;
                // HMR root reload
                {
                    context.reload = () => {
                        render(cloneVNode(vnode), rootContainer);
                    };
                }
                if (isHydrate && hydrate) {
                    hydrate(vnode, rootContainer);
                }
                else {
                    render(vnode, rootContainer);
                }
                isMounted = true;
                app._container = rootContainer;
                rootContainer.__vue_app__ = app;
                {
                    devtoolsInitApp(app, version);
                }
                return vnode.component.proxy;
            }
            else {
                warn(`App has already been mounted.\n` +
                    `If you want to remount the same app, move your app creation logic ` +
                    `into a factory function and create fresh app instances for each ` +
                    `mount - e.g. \`const createMyApp = () => createApp(App)\``);
            }
        },
        unmount() {
            if (isMounted) {
                render(null, app._container);
                {
                    devtoolsUnmountApp(app);
                }
            }
            else {
                warn(`Cannot unmount an app that is not mounted.`);
            }
        },
        provide(key, value) {
            if ( key in context.provides) {
                warn(`App already provides property with key "${String(key)}". ` +
                    `It will be overwritten with the new value.`);
            }
            // TypeScript doesn't allow symbols as index type
            // https://github.com/Microsoft/TypeScript/issues/24587
            context.provides[key] = value;
            return app;
        }
    });
    return app;
};
// app context
function createAppContext() {
    return {
        app: null,
        config: {
            isNativeTag: NO,
            performance: false,
            globalProperties: {},
            optionMergeStrategies: {},
            isCustomElement: NO,
            errorHandler: undefined,
            warnHandler: undefined
        },
        mixins: [],
        components: {},
        directives: {},
        provides: Object.create(null)
    };
}

/**
 * mount
 * 1. createVNode(rootComponent, rootProps)
 * 2. render(cloneVNode(vnode), rootContainer) | hydrate(vnode, rootContainer);
 * 3. devtoolsInitApp(app, version);
 */

function mount(rootContainer, isHydrate) {
    if (!isMounted) {
        const vnode = createVNode(rootComponent, rootProps);
        // store app context on the root VNode.
        // this will be set on the root instance on initial mount.
        vnode.appContext = context;
        // HMR root reload
        {
            context.reload = () => {
                render(cloneVNode(vnode), rootContainer);
            };
        }
        if (isHydrate && hydrate) {
            hydrate(vnode, rootContainer);
        }
        else {
            render(vnode, rootContainer);
        }
        isMounted = true;
        app._container = rootContainer;
        rootContainer.__vue_app__ = app;
        {
            devtoolsInitApp(app, version);
        }
        return vnode.component.proxy;
    }
    else {
        warn(`App has already been mounted.\n` +
            `If you want to remount the same app, move your app creation logic ` +
            `into a factory function and create fresh app instances for each ` +
            `mount - e.g. \`const createMyApp = () => createApp(App)\``);
    }
}

// createVNode 2997
const createVNode = ( createVNodeWithArgsTransform);
const createVNodeWithArgsTransform = (...args) => {
    return _createVNode(...(vnodeArgsTransformer ? vnodeArgsTransformer(args, currentRenderingInstance) : args))
}

function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
    if (!type || type === NULL_DYNAMIC_COMPONENT) {
        if ( !type) {
            warn(`Invalid vnode type when creating vnode: ${type}.`);
        }
        type = Comment;
    }
    if (isVNode(type)) {
        // createVNode receiving an existing vnode. This happens in cases like
        // <component :is="vnode"/>
        // #2078 make sure to merge refs during the clone instead of overwriting it
        const cloned = cloneVNode(type, props, true /* mergeRef: true */);
        if (children) {
            normalizeChildren(cloned, children);
        }
        return cloned;
    }
    // class component normalization.
    if (isClassComponent(type)) {
        type = type.__vccOpts;
    }
    // class & style normalization.
    if (props) {
        // for reactive or proxy objects, we need to clone it to enable mutation.
        if (isProxy(props) || InternalObjectKey in props) {
            props = extend({}, props);
        }
        let { class: klass, style } = props;
        if (klass && !isString(klass)) {
            props.class = normalizeClass(klass);
        }
        if (isObject(style)) {
            // reactive state objects need to be cloned since they are likely to be
            // mutated
            if (isProxy(style) && !isArray(style)) {
                style = extend({}, style);
            }
            props.style = normalizeStyle(style);
        }
    }
    // encode the vnode type information into a bitmap
    const shapeFlag = isString(type)
        ? 1 /* ELEMENT */
        :  isSuspense(type)
            ? 128 /* SUSPENSE */
            : isTeleport(type)
                ? 64 /* TELEPORT */
                : isObject(type)
                    ? 4 /* STATEFUL_COMPONENT */
                    : isFunction(type)
                        ? 2 /* FUNCTIONAL_COMPONENT */
                        : 0;
    if ( shapeFlag & 4 /* STATEFUL_COMPONENT */ && isProxy(type)) {
        type = toRaw(type);
        warn(`Vue received a Component which was made a reactive object. This can ` +
            `lead to unnecessary performance overhead, and should be avoided by ` +
            `marking the component with \`markRaw\` or using \`shallowRef\` ` +
            `instead of \`ref\`.`, `\nComponent that was made reactive: `, type);
    }
    const vnode = {
        __v_isVNode: true,
        ["__v_skip" /* SKIP */]: true,
        type,
        props,
        key: props && normalizeKey(props),
        ref: props && normalizeRef(props),
        scopeId: currentScopeId,
        children: null,
        component: null,
        suspense: null,
        ssContent: null,
        ssFallback: null,
        dirs: null,
        transition: null,
        el: null,
        anchor: null,
        target: null,
        targetAnchor: null,
        staticCount: 0,
        shapeFlag,
        patchFlag,
        dynamicProps,
        dynamicChildren: null,
        appContext: null
    };
    // validate key
    if ( vnode.key !== vnode.key) {
        warn(`VNode created with invalid key (NaN). VNode type:`, vnode.type);
    }
    normalizeChildren(vnode, children);
    // normalize suspense children
    if ( shapeFlag & 128 /* SUSPENSE */) {
        const { content, fallback } = normalizeSuspenseChildren(vnode);
        vnode.ssContent = content;
        vnode.ssFallback = fallback;
    }
    if (shouldTrack$1 > 0 &&
        // avoid a block node from tracking itself
        !isBlockNode &&
        // has current parent block
        currentBlock &&
        // presence of a patch flag indicates this node needs patching on updates.
        // component nodes also should always be patched, because even if the
        // component doesn't need to update, it needs to persist the instance on to
        // the next vnode so that it can be properly unmounted later.
        (patchFlag > 0 || shapeFlag & 6 /* COMPONENT */) &&
        // the EVENTS flag is only for hydration and if it is the only flag, the
        // vnode should not be considered dynamic due to handler caching.
        patchFlag !== 32 /* HYDRATE_EVENTS */) {
        currentBlock.push(vnode);
    }
    return vnode;
}