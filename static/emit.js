function emit(instance, event, ...args) {
    const props = instance.vnode.props || EMPTY_OBJ;
    {
        const { emitsOptions, propsOptions: [propsOptions] } = instance;
        if (emitsOptions) {
            if (!(event in emitsOptions)) {
                if (!propsOptions || !(`on` + capitalize(event) in propsOptions)) {
                    warn(`Component emitted event "${event}" but it is neither declared in ` +
                        `the emits option nor as an "on${capitalize(event)}" prop.`);
                }
            }
            else {
                const validator = emitsOptions[event];
                if (isFunction(validator)) {
                    const isValid = validator(...args);
                    if (!isValid) {
                        warn(`Invalid event arguments: event validation failed for event "${event}".`);
                    }
                }
            }
        }
    }
    {
        devtoolsComponentEmit(instance, event, args);
    }
    let handlerName = `on${capitalize(event)}`;
    let handler = props[handlerName];
    // for v-model update:xxx events, also trigger kebab-case equivalent
    // for props passed via kebab-case
    if (!handler && event.startsWith('update:')) {
        handlerName = `on${capitalize(hyphenate(event))}`;
        handler = props[handlerName];
    }
    if (!handler) {
        handler = props[handlerName + `Once`];
        if (!instance.emitted) {
            (instance.emitted = {})[handlerName] = true;
        }
        else if (instance.emitted[handlerName]) {
            return;
        }
    }
    if (handler) {
        callWithAsyncErrorHandling(handler, instance, 6 /* COMPONENT_EVENT_HANDLER */, args);
    }
}

// emitOption

const instance = {
    uid: uid$2++,
    // ...
    // resolved props and emits options
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext)
    // ...
}

function normalizeEmitsOptions(comp, appContext, asMixin = false) {
    const appId = appContext.app ? appContext.app._uid : -1;
    const cache = comp.__emits || (comp.__emits = {});
    const cached = cache[appId];
    if (cached !== undefined) {
        return cached;
    }
    const raw = comp.emits;
    let normalized = {};
    // apply mixin/extends props
    let hasExtends = false;
    if ( !isFunction(comp)) {
        const extendEmits = (raw) => {
            hasExtends = true;
            extend(normalized, normalizeEmitsOptions(raw, appContext, true));
        };
        if (!asMixin && appContext.mixins.length) {
            appContext.mixins.forEach(extendEmits);
        }
        if (comp.extends) {
            extendEmits(comp.extends);
        }
        if (comp.mixins) {
            comp.mixins.forEach(extendEmits);
        }
    }
    if (!raw && !hasExtends) {
        return (cache[appId] = null);
    }
    if (isArray(raw)) {
        raw.forEach(key => (normalized[key] = null));
    }
    else {
        extend(normalized, raw);
    }
    return (cache[appId] = normalized);
}
