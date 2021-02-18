/*
* ref
*/
function ref(value) {
    return createRef(value);
}
function createRef(rawValue, shallow = false) {
    if (isRef(rawValue)) {
        return rawValue;
    }
    return new RefImpl(rawValue, shallow);
}
class RefImpl {
    constructor(_rawValue, _shallow = false) {
        this._rawValue = _rawValue;
        this._shallow = _shallow;
        this.__v_isRef = true;
        this._value = _shallow ? _rawValue : convert(_rawValue);
    }
    get value() {
        track(toRaw(this), "get" /* GET */, 'value');
        return this._value;
    }
    set value(newVal) {
        if (hasChanged(toRaw(newVal), this._rawValue)) {
            this._rawValue = newVal;
            this._value = this._shallow ? newVal : convert(newVal);
            trigger(toRaw(this), "set" /* SET */, 'value', newVal);
        }
    }
}
/*
* reactive
*/
function reactive(target) {
    // if trying to observe a readonly proxy, return the readonly version.
    if (target && target["__v_isReadonly" /* IS_READONLY */]) {
        return target;
    }
    return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers);
}
function createReactiveObject(target, isReadonly, baseHandlers, collectionHandlers) {
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

