/*
* activeEffect
*/
let activeEffect;

function createReactiveEffect(fn, options) {
    const effect = function reactiveEffect() {
        if (!effect.active) {
            return options.scheduler ? undefined : fn();
        }
        if (!effectStack.includes(effect)) {
            cleanup(effect);
            try {
                enableTracking();
                effectStack.push(effect);
                activeEffect = effect;
                return fn();
            }
            finally {
                effectStack.pop();
                resetTracking();
                activeEffect = effectStack[effectStack.length - 1];
            }
        }
    };
    effect.id = uid++;
    effect._isEffect = true;
    effect.active = true;
    effect.raw = fn;
    effect.deps = [];
    effect.options = options;
    return effect;
}

function track(target, type, key) {
    if (!shouldTrack || activeEffect === undefined) {
        return;
    }
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, (dep = new Set()));
    }
    if (!dep.has(activeEffect)) {
        dep.add(activeEffect);
        activeEffect.deps.push(dep);
        if ( activeEffect.options.onTrack) {
            activeEffect.options.onTrack({
                effect: activeEffect,
                target,
                type,
                key
            });
        }
    }
}

/**
 * trigger & track
 */

const targetMap = new WeakMap();

function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);
    if (!depsMap) {
        // never been tracked
        return;
    }
    const effects = new Set();
    const add = (effectsToAdd) => {
        if (effectsToAdd) {
            effectsToAdd.forEach(effect => {
                if (effect !== activeEffect || effect.options.allowRecurse) {
                    effects.add(effect);
                }
            });
        }
    };
    if (type === "clear" /* CLEAR */) {
        // collection being cleared
        // trigger all effects for target
        depsMap.forEach(add);
    }
    else if (key === 'length' && isArray(target)) {
        depsMap.forEach((dep, key) => {
            if (key === 'length' || key >= newValue) {
                add(dep);
            }
        });
    }
    else {
        // schedule runs for SET | ADD | DELETE
        if (key !== void 0) {
            add(depsMap.get(key));
        }
        // also run for iteration key on ADD | DELETE | Map.SET
        switch (type) {
            case "add" /* ADD */:
                if (!isArray(target)) {
                    add(depsMap.get(ITERATE_KEY));
                    if (isMap(target)) {
                        add(depsMap.get(MAP_KEY_ITERATE_KEY));
                    }
                }
                else if (isIntegerKey(key)) {
                    // new index added to array -> length changes
                    add(depsMap.get('length'));
                }
                break;
            case "delete" /* DELETE */:
                if (!isArray(target)) {
                    add(depsMap.get(ITERATE_KEY));
                    if (isMap(target)) {
                        add(depsMap.get(MAP_KEY_ITERATE_KEY));
                    }
                }
                break;
            case "set" /* SET */:
                if (isMap(target)) {
                    add(depsMap.get(ITERATE_KEY));
                }
                break;
        }
    }
    const run = (effect) => {
        if ( effect.options.onTrigger) {
            effect.options.onTrigger({
                effect,
                target,
                key,
                type,
                newValue,
                oldValue,
                oldTarget
            });
        }
        if (effect.options.scheduler) {
            effect.options.scheduler(effect);
        }
        else {
            effect();
        }
    };
    effects.forEach(run);
}

function track(target, type, key) {
    if (!shouldTrack || activeEffect === undefined) {
        return;
    }
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, (dep = new Set()));
    }
    if (!dep.has(activeEffect)) {
        dep.add(activeEffect);
        activeEffect.deps.push(dep);
        if ( activeEffect.options.onTrack) {
            activeEffect.options.onTrack({
                effect: activeEffect,
                target,
                type,
                key
            });
        }
    }
}
        function createSetter(shallow = false) {
            return function set(target, key, value, receiver) {
                const oldValue = target[key];
                if (!shallow) {
                    value = toRaw(value);
                    if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
                        oldValue.value = value;
                        return true;
                    }
                }
                const hadKey = isArray(target) && isIntegerKey(key)
                    ? Number(key) < target.length
                    : hasOwn(target, key);
                const result = Reflect.set(target, key, value, receiver);
                // don't trigger if target is something up in the prototype chain of original
                if (target === toRaw(receiver)) {
                    if (!hadKey) {
                        trigger(target, "add" /* ADD */, key, value);
                    }
                    else if (hasChanged(value, oldValue)) {
                        trigger(target, "set" /* SET */, key, value, oldValue);
                    }
                }
                return result;
            };
        }

        function createGetter(isReadonly = false, shallow = false) {
            return function get(target, key, receiver) {
                if (key === "__v_isReactive" /* IS_REACTIVE */) {
                    return !isReadonly;
                }
                else if (key === "__v_isReadonly" /* IS_READONLY */) {
                    return isReadonly;
                }
                else if (key === "__v_raw" /* RAW */ &&
                    receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)) {
                    return target;
                }
                const targetIsArray = isArray(target);
                if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
                    return Reflect.get(arrayInstrumentations, key, receiver);
                }
                const res = Reflect.get(target, key, receiver);
                const keyIsSymbol = isSymbol(key);
                if (keyIsSymbol
                    ? builtInSymbols.has(key)
                    : key === `__proto__` || key === `__v_isRef`) {
                    return res;
                }
                if (!isReadonly) {
                    track(target, "get" /* GET */, key);
                }
                if (shallow) {
                    return res;
                }
                if (isRef(res)) {
                    // ref unwrapping - does not apply for Array + integer key.
                    const shouldUnwrap = !targetIsArray || !isIntegerKey(key);
                    return shouldUnwrap ? res.value : res;
                }
                if (isObject(res)) {
                    // Convert returned value into a proxy as well. we do the isObject check
                    // here to avoid invalid value warning. Also need to lazy access readonly
                    // and reactive here to avoid circular dependency.
                    return isReadonly ? readonly(res) : reactive(res);
                }
                return res;
            };
        }

/*
* component instance Proxy 
* Proxy 配置用 PublicInstanceProxyHandlers
*/

function setupStatefulComponent(instance, isSSR) {
    const Component = instance.type;
    // ...
    instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
    
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
    // ...
}

        const PublicInstanceProxyHandlers = {
            get({ _: instance }, key) {
                const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
                // let @vue/reactivity know it should never observe Vue public instances.
                if (key === "__v_skip" /* SKIP */) {
                    return true;
                }
                // data / props / ctx
                // This getter gets called for every property access on the render context
                // during render and is a major hotspot. The most expensive part of this
                // is the multiple hasOwn() calls. It's much faster to do a simple property
                // access on a plain object, so we use an accessCache object (with null
                // prototype) to memoize what access type a key corresponds to.
                let normalizedProps;
                if (key[0] !== '$') {
                    const n = accessCache[key];
                    if (n !== undefined) {
                        switch (n) {
                            case 0 /* SETUP */:
                                return setupState[key];
                            case 1 /* DATA */:
                                return data[key];
                            case 3 /* CONTEXT */:
                                return ctx[key];
                            case 2 /* PROPS */:
                                return props[key];
                            // default: just fallthrough
                        }
                    }
                    else if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
                        accessCache[key] = 0 /* SETUP */;
                        return setupState[key];
                    }
                    else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
                        accessCache[key] = 1 /* DATA */;
                        return data[key];
                    }
                    else if (
                    // only cache other properties when instance has declared (thus stable)
                    // props
                    (normalizedProps = instance.propsOptions[0]) &&
                        hasOwn(normalizedProps, key)) {
                        accessCache[key] = 2 /* PROPS */;
                        return props[key];
                    }
                    else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
                        accessCache[key] = 3 /* CONTEXT */;
                        return ctx[key];
                    }
                    else if ( !isInBeforeCreate) {
                        accessCache[key] = 4 /* OTHER */;
                    }
                }
                const publicGetter = publicPropertiesMap[key];
                let cssModule, globalProperties;
                // public $xxx properties
                if (publicGetter) {
                    if (key === '$attrs') {
                        track(instance, "get" /* GET */, key);
                        markAttrsAccessed();
                    }
                    return publicGetter(instance);
                }
                else if (
                // css module (injected by vue-loader)
                (cssModule = type.__cssModules) &&
                    (cssModule = cssModule[key])) {
                    return cssModule;
                }
                else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
                    // user may set custom properties to `this` that start with `$`
                    accessCache[key] = 3 /* CONTEXT */;
                    return ctx[key];
                }
                else if (
                // global properties
                ((globalProperties = appContext.config.globalProperties),
                    hasOwn(globalProperties, key))) {
                    return globalProperties[key];
                }
                else if (
                    currentRenderingInstance &&
                    (!isString(key) ||
                        // #1091 avoid internal isRef/isVNode checks on component instance leading
                        // to infinite warning loop
                        key.indexOf('__v') !== 0)) {
                    if (data !== EMPTY_OBJ &&
                        (key[0] === '$' || key[0] === '_') &&
                        hasOwn(data, key)) {
                        warn(`Property ${JSON.stringify(key)} must be accessed via $data because it starts with a reserved ` +
                            `character ("$" or "_") and is not proxied on the render context.`);
                    }
                    else {
                        warn(`Property ${JSON.stringify(key)} was accessed during render ` +
                            `but is not defined on instance.`);
                    }
                }
            },
            set({ _: instance }, key, value) {
                const { data, setupState, ctx } = instance;
                if (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) {
                    setupState[key] = value;
                }
                else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
                    data[key] = value;
                }
                else if (key in instance.props) {
                    
                        warn(`Attempting to mutate prop "${key}". Props are readonly.`, instance);
                    return false;
                }
                if (key[0] === '$' && key.slice(1) in instance) {
                    
                        warn(`Attempting to mutate public property "${key}". ` +
                            `Properties starting with $ are reserved and readonly.`, instance);
                    return false;
                }
                else {
                    if ( key in instance.appContext.config.globalProperties) {
                        Object.defineProperty(ctx, key, {
                            enumerable: true,
                            configurable: true,
                            value
                        });
                    }
                    else {
                        ctx[key] = value;
                    }
                }
                return true;
            },
            has({ _: { data, setupState, accessCache, ctx, appContext, propsOptions } }, key) {
                let normalizedProps;
                return (accessCache[key] !== undefined ||
                    (data !== EMPTY_OBJ && hasOwn(data, key)) ||
                    (setupState !== EMPTY_OBJ && hasOwn(setupState, key)) ||
                    ((normalizedProps = propsOptions[0]) && hasOwn(normalizedProps, key)) ||
                    hasOwn(ctx, key) ||
                    hasOwn(publicPropertiesMap, key) ||
                    hasOwn(appContext.config.globalProperties, key));
            }
        };
        {
            PublicInstanceProxyHandlers.ownKeys = (target) => {
                warn(`Avoid app logic that relies on enumerating keys on a component instance. ` +
                    `The keys will be empty in production mode to avoid performance overhead.`);
                return Reflect.ownKeys(target);
            };
        }


/*
* Component data 的 proxy， 单独对data进行get,set...
* Proxy 配置用的是 mutableHandlers, mutableCollectionHandlers
*/

function applyOptions(instance, options, deferredData = [], deferredWatch = [], asMixin = false) {
    // ...
    if (!asMixin) {
        if (deferredData.length) {
            deferredData.forEach(dataFn => resolveData(instance, dataFn, publicThis));
        }
        if (dataOptions) {
            resolveData(instance, dataOptions, publicThis);
        }
        {
            const rawData = toRaw(instance.data);
            for (const key in rawData) {
                checkDuplicateProperties("Data" /* DATA */, key);
                // expose data on ctx during dev
                if (key[0] !== '$' && key[0] !== '_') {
                    Object.defineProperty(ctx, key, {
                        configurable: true,
                        enumerable: true,
                        get: () => rawData[key],
                        set: NOOP
                    });
                }
            }
        }
    }
    else if (dataOptions) {
        deferredData.push(dataOptions);
    }
    // ...
}

        function resolveData(instance, dataFn, publicThis) {
            if ( !isFunction(dataFn)) {
                warn(`The data option must be a function. ` +
                    `Plain object usage is no longer supported.`);
            }
            const data = dataFn.call(publicThis, publicThis);
            if ( isPromise(data)) {
                warn(`data() returned a Promise - note data() cannot be async; If you ` +
                    `intend to perform data fetching before component renders, use ` +
                    `async setup() + <Suspense>.`);
            }
            if (!isObject(data)) {
                warn(`data() should return an object.`);
            }
            else if (instance.data === EMPTY_OBJ) {
                instance.data = reactive(data);
            }
            else {
                // existing data: this is a mixin or extends.
                extend(instance.data, data);
            }
        }

        function reactive(target) {
            // if trying to observe a readonly proxy, return the readonly version.
            if (target && target["__v_isReadonly" /* IS_READONLY */]) {
                return target;
            }
            return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers);
        }

        function createReactiveObject(target, isReadonly, baseHandlers /* mutableHandlers */, collectionHandlers /* mutableCollectionHandlers */) {
            if (!isObject(target)) {
                {
                    console.warn(`value cannot be made reactive: ${String(target)}`);
                }
                return target;
            }
            // target is already a Proxy, return it.
            // exception: calling readonly() on a reactive object
            if (target["__v_raw" /* RAW */] &&
                !(isReadonly && target["__v_isReactive" /* IS_REACTIVE */])) {
                return target;
            }
            // target already has corresponding Proxy
            const proxyMap = isReadonly ? readonlyMap : reactiveMap;
            const existingProxy = proxyMap.get(target);
            if (existingProxy) {
                return existingProxy;
            }
            // only a whitelist of value types can be observed.
            const targetType = getTargetType(target);
            if (targetType === 0 /* INVALID */) {
                return target;
            }
            const proxy = new Proxy(target, targetType === 2 /* COLLECTION */ ? collectionHandlers : baseHandlers);
            proxyMap.set(target, proxy);
            return proxy;
        }

            const reactiveMap = new WeakMap();
            const readonlyMap = new WeakMap();

                // reactive data 格式校验
                function getTargetType(value) {
                    return value["__v_skip" /* SKIP */] || !Object.isExtensible(value) // 默认情况下，对象是可扩展的：即可以为他们添加新的属性。以及它们的 __proto__ 属性可以被更改。
                        ? 0 /* INVALID */
                        : targetTypeMap(toRawType(value));
                }

                    function targetTypeMap(rawType) {
                        switch (rawType) {
                            case 'Object':
                            case 'Array':
                                return 1 /* COMMON */;
                            case 'Map':
                            case 'Set':
                            case 'WeakMap':
                            case 'WeakSet':
                                return 2 /* COLLECTION */;
                            default:
                                return 0 /* INVALID */;
                        }
                    }
                    const toRawType = (value) => {
                        return toTypeString(value).slice(8, -1);
                    };

                const mutableHandlers = {
                    get,
                    set,
                    deleteProperty,
                    has,
                    ownKeys
                };
                const mutableCollectionHandlers = {
                    get: createInstrumentationGetter(false, false)
                };

                const get = /*#__PURE__*/ createGetter();
                const shallowGet = /*#__PURE__*/ createGetter(false, true);
                const readonlyGet = /*#__PURE__*/ createGetter(true);
                const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true);


                const arrayInstrumentations = {};
                ['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
                    const method = Array.prototype[key];
                    arrayInstrumentations[key] = function (...args) {
                        const arr = toRaw(this);
                        for (let i = 0, l = this.length; i < l; i++) {
                            track(arr, "get" /* GET */, i + '');
                        }
                        // we run the method using the original args first (which may be reactive)
                        const res = method.apply(arr, args);
                        if (res === -1 || res === false) {
                            // if that didn't work, run it again using raw values.
                            return method.apply(arr, args.map(toRaw));
                        }
                        else {
                            return res;
                        }
                    };
                });
                ['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
                    const method = Array.prototype[key];
                    arrayInstrumentations[key] = function (...args) {
                        pauseTracking();
                        const res = method.apply(this, args);
                        enableTracking();
                        return res;
                    };
                });

                function createGetter(isReadonly = false, shallow = false) {
                    return function get(target, key, receiver) {
                        if (key === "__v_isReactive" /* IS_REACTIVE */) {
                            return !isReadonly;
                        }
                        else if (key === "__v_isReadonly" /* IS_READONLY */) {
                            return isReadonly;
                        }
                        else if (key === "__v_raw" /* RAW */ &&
                            receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)) {
                            return target;
                        }
                        const targetIsArray = isArray(target);
                        if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
                            return Reflect.get(arrayInstrumentations, key, receiver);
                        }
                        const res = Reflect.get(target, key, receiver);
                        const keyIsSymbol = isSymbol(key);
                        if (keyIsSymbol
                            ? builtInSymbols.has(key)
                            : key === `__proto__` || key === `__v_isRef`) {
                            return res;
                        }
                        if (!isReadonly) {
                            track(target, "get" /* GET */, key);
                        }
                        if (shallow) {
                            return res;
                        }
                        if (isRef(res)) {
                            // ref unwrapping - does not apply for Array + integer key.
                            const shouldUnwrap = !targetIsArray || !isIntegerKey(key);
                            return shouldUnwrap ? res.value : res;
                        }
                        if (isObject(res)) {
                            // Convert returned value into a proxy as well. we do the isObject check
                            // here to avoid invalid value warning. Also need to lazy access readonly
                            // and reactive here to avoid circular dependency.
                            return isReadonly ? readonly(res) : reactive(res);
                        }
                        return res;
                    };
                }
                const set = /*#__PURE__*/ createSetter();
                const shallowSet = /*#__PURE__*/ createSetter(true);
                function createSetter(shallow = false) {
                    return function set(target, key, value, receiver) {
                        const oldValue = target[key];
                        if (!shallow) {
                            value = toRaw(value);
                            if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
                                oldValue.value = value;
                                return true;
                            }
                        }
                        const hadKey = isArray(target) && isIntegerKey(key)
                            ? Number(key) < target.length
                            : hasOwn(target, key);
                        const result = Reflect.set(target, key, value, receiver);
                        // don't trigger if target is something up in the prototype chain of original
                        if (target === toRaw(receiver)) {
                            if (!hadKey) {
                                trigger(target, "add" /* ADD */, key, value);
                            }
                            else if (hasChanged(value, oldValue)) {
                                trigger(target, "set" /* SET */, key, value, oldValue);
                            }
                        }
                        return result;
                    };
                }
                function deleteProperty(target, key) {
                    const hadKey = hasOwn(target, key);
                    const oldValue = target[key];
                    const result = Reflect.deleteProperty(target, key);
                    if (result && hadKey) {
                        trigger(target, "delete" /* DELETE */, key, undefined, oldValue);
                    }
                    return result;
                }
                function has(target, key) {
                    const result = Reflect.has(target, key);
                    if (!isSymbol(key) || !builtInSymbols.has(key)) {
                        track(target, "has" /* HAS */, key);
                    }
                    return result;
                }
                function ownKeys(target) {
                    track(target, "iterate" /* ITERATE */, ITERATE_KEY);
                    return Reflect.ownKeys(target);
                }


/*
* watcher
*/

function applyOptions(instance, options, deferredData = [], deferredWatch = [], asMixin = false) {
    // ...
    if (watchOptions) {
        deferredWatch.push(watchOptions);
    }
    if (!asMixin && deferredWatch.length) {
        deferredWatch.forEach(watchOptions => {
            for (const key in watchOptions) {
                createWatcher(watchOptions[key], ctx, publicThis, key);
            }
        });
    }
    // ...
}
        function createWatcher(raw, ctx, publicThis, key) {
            const getter = key.includes('.')
                ? createPathGetter(publicThis, key)
                : () => publicThis[key];
            if (isString(raw)) {
                const handler = ctx[raw];
                if (isFunction(handler)) {
                    watch(getter, handler);
                }
                else {
                    warn(`Invalid watch handler specified by key "${raw}"`, handler);
                }
            }
            else if (isFunction(raw)) {
                watch(getter, raw.bind(publicThis));
            }
            else if (isObject(raw)) {
                if (isArray(raw)) {
                    raw.forEach(r => createWatcher(r, ctx, publicThis, key));
                }
                else {
                    const handler = isFunction(raw.handler)
                        ? raw.handler.bind(publicThis)
                        : ctx[raw.handler];
                    if (isFunction(handler)) {
                        watch(getter, handler, raw);
                    }
                    else {
                        warn(`Invalid watch handler specified by key "${raw.handler}"`, handler);
                    }
                }
            }
            else {
                warn(`Invalid watch option: "${key}"`, raw);
            }
        }
                function createPathGetter(ctx, path) {
                    const segments = path.split('.');
                    return () => {
                        let cur = ctx;
                        for (let i = 0; i < segments.length && cur; i++) {
                            cur = cur[segments[i]];
                        }
                        return cur;
                    };
                }
        // initial value for watchers to trigger on undefined initial values
        const INITIAL_WATCHER_VALUE = {};
        // implementation
        function watch(source, cb, options) {
            if ( !isFunction(cb)) {
                warn(`\`watch(fn, options?)\` signature has been moved to a separate API. ` +
                    `Use \`watchEffect(fn, options?)\` instead. \`watch\` now only ` +
                    `supports \`watch(source, cb, options?) signature.`);
            }
            return doWatch(source, cb, options);
        }
        function doWatch(source, cb, { immediate, deep, flush, onTrack, onTrigger } = EMPTY_OBJ, instance = currentInstance) {
            if ( !cb) {
                if (immediate !== undefined) {
                    warn(`watch() "immediate" option is only respected when using the ` +
                        `watch(source, callback, options?) signature.`);
                }
                if (deep !== undefined) {
                    warn(`watch() "deep" option is only respected when using the ` +
                        `watch(source, callback, options?) signature.`);
                }
            }
            const warnInvalidSource = (s) => {
                warn(`Invalid watch source: `, s, `A watch source can only be a getter/effect function, a ref, ` +
                    `a reactive object, or an array of these types.`);
            };
            let getter;
            const isRefSource = isRef(source);
            if (isRefSource) {
                getter = () => source.value;
            }
            else if (isReactive(source)) {
                getter = () => source;
                deep = true;
            }
            else if (isArray(source)) {
                getter = () => source.map(s => {
                    if (isRef(s)) {
                        return s.value;
                    }
                    else if (isReactive(s)) {
                        return traverse(s);
                    }
                    else if (isFunction(s)) {
                        return callWithErrorHandling(s, instance, 2 /* WATCH_GETTER */);
                    }
                    else {
                        warnInvalidSource(s);
                    }
                });
            }
            else if (isFunction(source)) {
                if (cb) {
                    // getter with cb
                    getter = () => callWithErrorHandling(source, instance, 2 /* WATCH_GETTER */);
                }
                else {
                    // no cb -> simple effect
                    getter = () => {
                        if (instance && instance.isUnmounted) {
                            return;
                        }
                        if (cleanup) {
                            cleanup();
                        }
                        return callWithErrorHandling(source, instance, 3 /* WATCH_CALLBACK */, [onInvalidate]);
                    };
                }
            }
            else {
                getter = NOOP;
                warnInvalidSource(source);
            }
            if (cb && deep) {
                const baseGetter = getter;
                getter = () => traverse(baseGetter());
            }
            let cleanup;
            const onInvalidate = (fn) => {
                cleanup = runner.options.onStop = () => {
                    callWithErrorHandling(fn, instance, 4 /* WATCH_CLEANUP */);
                };
            };
            let oldValue = isArray(source) ? [] : INITIAL_WATCHER_VALUE;
            const job = () => {
                if (!runner.active) {
                    return;
                }
                if (cb) {
                    // watch(source, cb)
                    const newValue = runner();
                    if (deep || isRefSource || hasChanged(newValue, oldValue)) {
                        // cleanup before running cb again
                        if (cleanup) {
                            cleanup();
                        }
                        callWithAsyncErrorHandling(cb, instance, 3 /* WATCH_CALLBACK */, [
                            newValue,
                            // pass undefined as the old value when it's changed for the first time
                            oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
                            onInvalidate
                        ]);
                        oldValue = newValue;
                    }
                }
                else {
                    // watchEffect
                    runner();
                }
            };
            // important: mark the job as a watcher callback so that scheduler knows it
            // it is allowed to self-trigger (#1727)
            job.allowRecurse = !!cb;
            let scheduler;
            if (flush === 'sync') {
                scheduler = job;
            }
            else if (flush === 'post') {
                scheduler = () => queuePostRenderEffect(job, instance && instance.suspense);
            }
            else {
                // default: 'pre'
                scheduler = () => {
                    if (!instance || instance.isMounted) {
                        queuePreFlushCb(job);
                    }
                    else {
                        // with 'pre' option, the first call must happen before
                        // the component is mounted so it is called synchronously.
                        job();
                    }
                };
            }
            const runner = effect(getter, {
                lazy: true,
                onTrack,
                onTrigger,
                scheduler
            });
            recordInstanceBoundEffect(runner);
            // initial run
            if (cb) {
                if (immediate) {
                    job();
                }
                else {
                    oldValue = runner();
                }
            }
            else if (flush === 'post') {
                queuePostRenderEffect(runner, instance && instance.suspense);
            }
            else {
                runner();
            }
            return () => {
                stop(runner);
                if (instance) {
                    remove(instance.effects, runner);
                }
            };
        }

        
        const pendingPreFlushCbs = [];
        let activePreFlushCbs = null;
        let preFlushIndex = 0;
        const pendingPostFlushCbs = [];
        let activePostFlushCbs = null;

        function queuePreFlushCb(cb) {
            queueCb(cb, activePreFlushCbs, pendingPreFlushCbs, preFlushIndex);
        }
        function queuePostFlushCb(cb) {
            queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex);
        }
        function queueCb(cb, activeQueue, pendingQueue, index) {
            if (!isArray(cb)) {
                if (!activeQueue ||
                    !activeQueue.includes(cb, cb.allowRecurse ? index + 1 : index)) {
                    pendingQueue.push(cb);
                }
            }
            else {
                // if cb is an array, it is a component lifecycle hook which can only be
                // triggered by a job, which is already deduped in the main queue, so
                // we can skip duplicate check here to improve perf
                pendingQueue.push(...cb);
            }
            queueFlush();
        }
        function queueFlush() {
            if (!isFlushing && !isFlushPending) {
                isFlushPending = true;
                currentFlushPromise = resolvedPromise.then(flushJobs);
            }
        }
            function flushJobs(seen) {
                isFlushPending = false;
                isFlushing = true;
                {
                    seen = seen || new Map();
                }
                flushPreFlushCbs(seen);
                // Sort queue before flush.
                // This ensures that:
                // 1. Components are updated from parent to child. (because parent is always
                //    created before the child so its render effect will have smaller
                //    priority number)
                // 2. If a component is unmounted during a parent component's update,
                //    its update can be skipped.
                // Jobs can never be null before flush starts, since they are only invalidated
                // during execution of another flushed job.
                queue.sort((a, b) => getId(a) - getId(b));
                try {
                    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
                        const job = queue[flushIndex];
                        if (job) {
                            if (true) {
                                checkRecursiveUpdates(seen, job);
                            }
                            callWithErrorHandling(job, null, 14 /* SCHEDULER */);
                        }
                    }
                }
                finally {
                    flushIndex = 0;
                    queue.length = 0;
                    flushPostFlushCbs(seen);
                    isFlushing = false;
                    currentFlushPromise = null;
                    // some postFlushCb queued jobs!
                    // keep flushing until it drains.
                    if (queue.length || pendingPostFlushCbs.length) {
                        flushJobs(seen);
                    }
                }
            }

        const queuePostRenderEffect =  queueEffectWithSuspense
        function queueEffectWithSuspense(fn, suspense) {
            if (suspense && suspense.pendingBranch) {
                if (isArray(fn)) {
                    suspense.effects.push(...fn);
                }
                else {
                    suspense.effects.push(fn);
                }
            }
            else {
                queuePostFlushCb(fn);
            }
        }



/*
* computed
*/

function applyOptions(instance, options, deferredData = [], deferredWatch = [], asMixin = false) {
    // ...
    if (computedOptions) {
        for (const key in computedOptions) {
            const opt = computedOptions[key];
            const get = isFunction(opt)
                ? opt.bind(publicThis, publicThis)
                : isFunction(opt.get)
                    ? opt.get.bind(publicThis, publicThis)
                    : NOOP;
            if ( get === NOOP) {
                warn(`Computed property "${key}" has no getter.`);
            }
            const set = !isFunction(opt) && isFunction(opt.set)
                ? opt.set.bind(publicThis)
                :  () => {
                        warn(`Write operation failed: computed property "${key}" is readonly.`);
                    }
                    ;
            const c = computed$1({
                get,
                set
            });
            Object.defineProperty(ctx, key, {
                enumerable: true,
                configurable: true,
                get: () => c.value,
                set: v => (c.value = v)
            });
            {
                checkDuplicateProperties("Computed" /* COMPUTED */, key);
            }
        }
    }
    // ...
}

        function computed$1(getterOrOptions) {
            const c = computed(getterOrOptions);
            recordInstanceBoundEffect(c.effect);
            return c;
        }

        // record effects created during a component's setup() so that they can be
        // stopped when the component unmounts
        function recordInstanceBoundEffect(effect) {
            if (currentInstance) {
                (currentInstance.effects || (currentInstance.effects = [])).push(effect);
            }
        }

        function computed(getterOrOptions) {
            let getter;
            let setter;
            if (isFunction(getterOrOptions)) {
                getter = getterOrOptions;
                setter =  () => {
                        console.warn('Write operation failed: computed value is readonly');
                    }
                    ;
            }
            else {
                getter = getterOrOptions.get;
                setter = getterOrOptions.set;
            }
            return new ComputedRefImpl(getter, setter, isFunction(getterOrOptions) || !getterOrOptions.set);
        }

        class ComputedRefImpl {
            constructor(getter, _setter, isReadonly) {
                this._setter = _setter;
                this._dirty = true;
                this.__v_isRef = true;
                this.effect = effect(getter, {
                    lazy: true,
                    scheduler: () => {
                        if (!this._dirty) {
                            this._dirty = true;
                            trigger(toRaw(this), "set" /* SET */, 'value');
                        }
                    }
                });
                this["__v_isReadonly" /* IS_READONLY */] = isReadonly;
            }
            get value() {
                if (this._dirty) {
                    this._value = this.effect();
                    this._dirty = false;
                }
                track(toRaw(this), "get" /* GET */, 'value');
                return this._value;
            }
            set value(newValue) {
                this._setter(newValue);
            }
        }


        /**
         * effect
         */

        const targetMap = new WeakMap();
        const effectStack = [];
        let activeEffect;
        const ITERATE_KEY = Symbol( 'iterate' );
        const MAP_KEY_ITERATE_KEY = Symbol( 'Map key iterate' );
        function isEffect(fn) {
            return fn && fn._isEffect === true;
        }
        function effect(fn, options = EMPTY_OBJ) {
            if (isEffect(fn)) {
                fn = fn.raw;
            }
            const effect = createReactiveEffect(fn, options);
            if (!options.lazy) {
                effect();
            }
            return effect;
        }
        function stop(effect) {
            if (effect.active) {
                cleanup(effect);
                if (effect.options.onStop) {
                    effect.options.onStop();
                }
                effect.active = false;
            }
        }
        let uid = 0;
        function createReactiveEffect(fn, options) {
            const effect = function reactiveEffect() {
                if (!effect.active) {
                    return options.scheduler ? undefined : fn();
                }
                if (!effectStack.includes(effect)) {
                    cleanup(effect);
                    try {
                        enableTracking();
                        effectStack.push(effect);
                        activeEffect = effect;
                        return fn();
                    }
                    finally {
                        effectStack.pop();
                        resetTracking();
                        activeEffect = effectStack[effectStack.length - 1];
                    }
                }
            };
            effect.id = uid++;
            effect._isEffect = true;
            effect.active = true;
            effect.raw = fn;
            effect.deps = [];
            effect.options = options;
            return effect;
        }
        function cleanup(effect) {
            const { deps } = effect;
            if (deps.length) {
                for (let i = 0; i < deps.length; i++) {
                    deps[i].delete(effect);
                }
                deps.length = 0;
            }
        }

        /**
         * track
         */

        let shouldTrack = true;
        const trackStack = [];
        function pauseTracking() {
            trackStack.push(shouldTrack);
            shouldTrack = false;
        }
        function enableTracking() {
            trackStack.push(shouldTrack);
            shouldTrack = true;
        }
        function resetTracking() {
            const last = trackStack.pop();
            shouldTrack = last === undefined ? true : last;
        }
        function track(target, type, key) {
            if (!shouldTrack || activeEffect === undefined) {
                return;
            }
            let depsMap = targetMap.get(target);
            if (!depsMap) {
                targetMap.set(target, (depsMap = new Map()));
            }
            let dep = depsMap.get(key);
            if (!dep) {
                depsMap.set(key, (dep = new Set()));
            }
            if (!dep.has(activeEffect)) {
                dep.add(activeEffect);
                activeEffect.deps.push(dep);
                if ( activeEffect.options.onTrack) {
                    activeEffect.options.onTrack({
                        effect: activeEffect,
                        target,
                        type,
                        key
                    });
                }
            }
        }