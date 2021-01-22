
 // TODO:  入口
 const createApp = ((...args) => {
    const app = ensureRenderer().createApp(...args);
    {
        injectNativeTagCheck(app);
    }
    const { mount } = app;
    app.mount = (containerOrSelector) => { // 改写了原来的mount
        const container = normalizeContainer(containerOrSelector);
        if (!container)
            return;
        const component = app._component;
        if (!isFunction(component) && !component.render && !component.template) {
            component.template = container.innerHTML;
        }
        // clear content before mounting
        container.innerHTML = '';
        const proxy = mount(container);
        container.removeAttribute('v-cloak');
        container.setAttribute('data-v-app', '');
        return proxy;
    };
    return app;
});



function createAppAPI(render, hydrate) {
    return function createApp(rootComponent, rootProps = null) {
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
}
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
const render = (vnode, container) => {
    if (vnode == null) {
        if (container._vnode) {
            unmount(container._vnode, null, null, true);
        }
    }
    else {
        patch(container._vnode || null, vnode, container);
    }
    flushPostFlushCbs();
    container._vnode = vnode;
};

// 1. createVNode
const createVNode = ( createVNodeWithArgsTransform);
const createVNodeWithArgsTransform = (...args) => {
    return _createVNode(...(vnodeArgsTransformer
        ? vnodeArgsTransformer(args, currentRenderingInstance)
        : args));
};

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

function normalizeVNode(child) {
    if (child == null || typeof child === 'boolean') {
        // empty placeholder
        return createVNode(Comment);
    }
    else if (isArray(child)) {
        // fragment
        return createVNode(Fragment, null, child);
    }
    else if (typeof child === 'object') {
        // already vnode, this should be the most common since compiled templates
        // always produce all-vnode children arrays
        return child.el === null ? child : cloneVNode(child);
    }
    else {
        // strings and numbers
        return createVNode(Text, null, String(child));
    }
}
const mountChildren = (children, container, anchor, parentComponent, parentSuspense, isSVG, optimized, start = 0) => {
    for (let i = start; i < children.length; i++) {
        const child = (children[i] = optimized
            ? cloneIfMounted(children[i])
            : normalizeVNode(children[i]));
        patch(null, child, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
    }
};

const patch = (n1, n2, container, anchor = null, parentComponent = null, parentSuspense = null, isSVG = false, optimized = false) => {
    // patching & not same type, unmount old tree
    if (n1 && !isSameVNodeType(n1, n2)) {
        anchor = getNextHostNode(n1);
        unmount(n1, parentComponent, parentSuspense, true);
        n1 = null;
    }
    if (n2.patchFlag === -2 /* BAIL */) {
        optimized = false;
        n2.dynamicChildren = null;
    }
    const { type, ref, shapeFlag } = n2;
    switch (type) {
        case Text:
            processText(n1, n2, container, anchor);
            break;
        case Comment:
            processCommentNode(n1, n2, container, anchor);
            break;
        case Static:
            if (n1 == null) {
                mountStaticNode(n2, container, anchor, isSVG);
            }
            else {
                patchStaticNode(n1, n2, container, isSVG);
            }
            break;
        case Fragment:
            processFragment(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
            break;
        default:
            if (shapeFlag & 1 /* ELEMENT */) {
                processElement(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
            }
            else if (shapeFlag & 6 /* COMPONENT */) {
                processComponent(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
            }
            else if (shapeFlag & 64 /* TELEPORT */) {
                type.process(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized, internals);
            }
            else if ( shapeFlag & 128 /* SUSPENSE */) {
                type.process(n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized, internals);
            }
            else {
                warn('Invalid VNode type:', type, `(${typeof type})`);
            }
    }
    // set ref
    if (ref != null && parentComponent) {
        setRef(ref, n1 && n1.ref, parentComponent, parentSuspense, n2);
    }
};
    // const { 
    //     insert: hostInsert, 
    //     remove: hostRemove, 
    //     patchProp: hostPatchProp, 
    //     forcePatchProp: hostForcePatchProp, 
    //     createElement: hostCreateElement, 
    //     createText: hostCreateText, 
    //     createComment: hostCreateComment, 
    //     setText: hostSetText, 
    //     setElementText: hostSetElementText, 
    //     parentNode: hostParentNode, 
    //     nextSibling: hostNextSibling, 
    //     setScopeId: hostSetScopeId = NOOP, 
    //     cloneNode: hostCloneNode, 
    //     insertStaticContent: hostInsertStaticContent 
    // } = options;
    
    const nodeOps = {
        insert: (child, parent, anchor) => {
            parent.insertBefore(child, anchor || null);
        },
        remove: child => {
            const parent = child.parentNode;
            if (parent) {
                parent.removeChild(child);
            }
        },
        createElement: (tag, isSVG, is) => isSVG
            ? doc.createElementNS(svgNS, tag)
            : doc.createElement(tag, is ? { is } : undefined),
        createText: text => doc.createTextNode(text),
        createComment: text => doc.createComment(text),
        setText: (node, text) => {
            node.nodeValue = text;
        },
        setElementText: (el, text) => {
            el.textContent = text;
        },
        parentNode: node => node.parentNode,
        nextSibling: node => node.nextSibling,
        querySelector: selector => doc.querySelector(selector),
        setScopeId(el, id) {
            el.setAttribute(id, '');
        },
        cloneNode(el) {
            return el.cloneNode(true);
        },
        // __UNSAFE__
        // Reason: innerHTML.
        // Static content here can only come from compiled templates.
        // As long as the user only uses trusted templates, this is safe.
        insertStaticContent(content, parent, anchor, isSVG) {
            const temp = isSVG
                ? tempSVGContainer ||
                    (tempSVGContainer = doc.createElementNS(svgNS, 'svg'))
                : tempContainer || (tempContainer = doc.createElement('div'));
            temp.innerHTML = content;
            const first = temp.firstChild;
            let node = first;
            let last = node;
            while (node) {
                last = node;
                nodeOps.insert(node, parent, anchor);
                node = temp.firstChild;
            }
            return [first, last];
        }
    };

    const processText = (n1, n2, container, anchor) => {
        if (n1 == null) {
            hostInsert((n2.el = hostCreateText(n2.children)), container, anchor);
        }
        else {
            const el = (n2.el = n1.el);
            if (n2.children !== n1.children) {
                hostSetText(el, n2.children);
            }
        }
    };

    const processCommentNode = (n1, n2, container, anchor) => {
        if (n1 == null) {
            hostInsert((n2.el = hostCreateComment(n2.children || '')), container, anchor);
        }
        else {
            // there's no support for dynamic comments
            n2.el = n1.el;
        }
    };

    const mountStaticNode = (n2, container, anchor, isSVG) => {
        [n2.el, n2.anchor] = hostInsertStaticContent(n2.children, container, anchor, isSVG);
    };
    /**
     * Dev / HMR only
     */
    const patchStaticNode = (n1, n2, container, isSVG) => {
        // static nodes are only patched during dev for HMR
        if (n2.children !== n1.children) {
            const anchor = hostNextSibling(n1.anchor);
            // remove existing
            removeStaticNode(n1);
            [n2.el, n2.anchor] = hostInsertStaticContent(n2.children, container, anchor, isSVG);
        }
        else {
            n2.el = n1.el;
            n2.anchor = n1.anchor;
        }
    };
        const removeStaticNode = (vnode) => {
            let cur = vnode.el;
            while (cur && cur !== vnode.anchor) {
                const next = hostNextSibling(cur);
                hostRemove(cur);
                cur = next;
            }
            hostRemove(vnode.anchor);
        };


        // function normalizeVNode(child) {
        //     if (child == null || typeof child === 'boolean') {
        //         // empty placeholder
        //         return createVNode(Comment);
        //     }
        //     else if (isArray(child)) {
        //         // fragment
        //         return createVNode(Fragment, null, child);
        //     }
        //     else if (typeof child === 'object') {
        //         // already vnode, this should be the most common since compiled templates
        //         // always produce all-vnode children arrays
        //         return child.el === null ? child : cloneVNode(child);
        //     }
        //     else {
        //         // strings and numbers
        //         return createVNode(Text, null, String(child));
        //     }
        // }


        const processFragment = (n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) => {
            const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''));
            const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''));
            let { patchFlag, dynamicChildren } = n2;
            if (patchFlag > 0) {
                optimized = true;
            }
            if ( isHmrUpdating) {
                // HMR updated, force full diff
                patchFlag = 0;
                optimized = false;
                dynamicChildren = null;
            }
            if (n1 == null) {
                hostInsert(fragmentStartAnchor, container, anchor);
                hostInsert(fragmentEndAnchor, container, anchor);
                // a fragment can only have array children
                // since they are either generated by the compiler, or implicitly created
                // from arrays.
                mountChildren(n2.children, container, fragmentEndAnchor, parentComponent, parentSuspense, isSVG, optimized);
            }
            else {
                if (patchFlag > 0 &&
                    patchFlag & 64 /* STABLE_FRAGMENT */ &&
                    dynamicChildren) {
                    // a stable fragment (template root or <template v-for>) doesn't need to
                    // patch children order, but it may contain dynamicChildren.
                    patchBlockChildren(n1.dynamicChildren, dynamicChildren, container, parentComponent, parentSuspense, isSVG);
                    if ( parentComponent && parentComponent.type.__hmrId) {
                        traverseStaticChildren(n1, n2);
                    }
                    else if (
                    // #2080 if the stable fragment has a key, it's a <template v-for> that may
                    //  get moved around. Make sure all root level vnodes inherit el.
                    // #2134 or if it's a component root, it may also get moved around
                    // as the component is being moved.
                    n2.key != null ||
                        (parentComponent && n2 === parentComponent.subTree)) {
                        traverseStaticChildren(n1, n2, true /* shallow */);
                    }
                }
                else {
                    // keyed / unkeyed, or manual fragments.
                    // for keyed & unkeyed, since they are compiler generated from v-for,
                    // each child is guaranteed to be a block so the fragment will never
                    // have dynamicChildren.
                    patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent, parentSuspense, isSVG, optimized);
                }
            }
        };

        const processElement = (n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) => {
            isSVG = isSVG || n2.type === 'svg';
            if (n1 == null) {
                mountElement(n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
            }
            else {
                patchElement(n1, n2, parentComponent, parentSuspense, isSVG, optimized);
            }
        };

                const mountElement = (vnode, container, anchor, parentComponent, parentSuspense, isSVG, optimized) => {
                    let el;
                    let vnodeHook;
                    const { type, props, shapeFlag, transition, scopeId, patchFlag, dirs } = vnode;
                    {
                        el = vnode.el = hostCreateElement(vnode.type, isSVG, props && props.is);
                        // mount children first, since some props may rely on child content
                        // being already rendered, e.g. `<select value>`
                        if (shapeFlag & 8 /* TEXT_CHILDREN */) {
                            hostSetElementText(el, vnode.children);
                        }
                        else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                            mountChildren(vnode.children, el, null, parentComponent, parentSuspense, isSVG && type !== 'foreignObject', optimized || !!vnode.dynamicChildren);
                        }
                        if (dirs) {
                            invokeDirectiveHook(vnode, null, parentComponent, 'created');
                        }
                        // props
                        if (props) {
                            for (const key in props) {
                                if (!isReservedProp(key)) {
                                    hostPatchProp(el, key, null, props[key], isSVG, vnode.children, parentComponent, parentSuspense, unmountChildren);
                                }
                            }
                            if ((vnodeHook = props.onVnodeBeforeMount)) {
                                invokeVNodeHook(vnodeHook, parentComponent, vnode);
                            }
                        }
                        // scopeId
                        setScopeId(el, scopeId, vnode, parentComponent);
                    }
                    {
                        Object.defineProperty(el, '__vnode', {
                            value: vnode,
                            enumerable: false
                        });
                        Object.defineProperty(el, '__vueParentComponent', {
                            value: parentComponent,
                            enumerable: false
                        });
                    }
                    if (dirs) {
                        invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount');
                    }
                    // #1583 For inside suspense + suspense not resolved case, enter hook should call when suspense resolved
                    // #1689 For inside suspense + suspense resolved case, just call it
                    const needCallTransitionHooks = (!parentSuspense || (parentSuspense && !parentSuspense.pendingBranch)) &&
                        transition &&
                        !transition.persisted;
                    if (needCallTransitionHooks) {
                        transition.beforeEnter(el);
                    }
                    hostInsert(el, container, anchor);
                    if ((vnodeHook = props && props.onVnodeMounted) ||
                        needCallTransitionHooks ||
                        dirs) {
                        queuePostRenderEffect(() => {
                            vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
                            needCallTransitionHooks && transition.enter(el);
                            dirs && invokeDirectiveHook(vnode, null, parentComponent, 'mounted');
                        }, parentSuspense);
                    }
                };

                const patchElement = (n1, n2, parentComponent, parentSuspense, isSVG, optimized) => {
                    const el = (n2.el = n1.el);
                    let { patchFlag, dynamicChildren, dirs } = n2;
                    // #1426 take the old vnode's patch flag into account since user may clone a
                    // compiler-generated vnode, which de-opts to FULL_PROPS
                    patchFlag |= n1.patchFlag & 16 /* FULL_PROPS */;
                    const oldProps = n1.props || EMPTY_OBJ;
                    const newProps = n2.props || EMPTY_OBJ;
                    let vnodeHook;
                    if ((vnodeHook = newProps.onVnodeBeforeUpdate)) {
                        invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
                    }
                    if (dirs) {
                        invokeDirectiveHook(n2, n1, parentComponent, 'beforeUpdate');
                    }
                    if ( isHmrUpdating) {
                        // HMR updated, force full diff
                        patchFlag = 0;
                        optimized = false;
                        dynamicChildren = null;
                    }
                    if (patchFlag > 0) {
                        // the presence of a patchFlag means this element's render code was
                        // generated by the compiler and can take the fast path.
                        // in this path old node and new node are guaranteed to have the same shape
                        // (i.e. at the exact same position in the source template)
                        if (patchFlag & 16 /* FULL_PROPS */) {
                            // element props contain dynamic keys, full diff needed
                            patchProps(el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG);
                        }
                        else {
                            // class
                            // this flag is matched when the element has dynamic class bindings.
                            if (patchFlag & 2 /* CLASS */) {
                                if (oldProps.class !== newProps.class) {
                                    hostPatchProp(el, 'class', null, newProps.class, isSVG);
                                }
                            }
                            // style
                            // this flag is matched when the element has dynamic style bindings
                            if (patchFlag & 4 /* STYLE */) {
                                hostPatchProp(el, 'style', oldProps.style, newProps.style, isSVG);
                            }
                            // props
                            // This flag is matched when the element has dynamic prop/attr bindings
                            // other than class and style. The keys of dynamic prop/attrs are saved for
                            // faster iteration.
                            // Note dynamic keys like :[foo]="bar" will cause this optimization to
                            // bail out and go through a full diff because we need to unset the old key
                            if (patchFlag & 8 /* PROPS */) {
                                // if the flag is present then dynamicProps must be non-null
                                const propsToUpdate = n2.dynamicProps;
                                for (let i = 0; i < propsToUpdate.length; i++) {
                                    const key = propsToUpdate[i];
                                    const prev = oldProps[key];
                                    const next = newProps[key];
                                    if (next !== prev ||
                                        (hostForcePatchProp && hostForcePatchProp(el, key))) {
                                        hostPatchProp(el, key, prev, next, isSVG, n1.children, parentComponent, parentSuspense, unmountChildren);
                                    }
                                }
                            }
                        }
                        // text
                        // This flag is matched when the element has only dynamic text children.
                        if (patchFlag & 1 /* TEXT */) {
                            if (n1.children !== n2.children) {
                                hostSetElementText(el, n2.children);
                            }
                        }
                    }
                    else if (!optimized && dynamicChildren == null) {
                        // unoptimized, full diff
                        patchProps(el, n2, oldProps, newProps, parentComponent, parentSuspense, isSVG);
                    }
                    const areChildrenSVG = isSVG && n2.type !== 'foreignObject';
                    if (dynamicChildren) {
                        patchBlockChildren(n1.dynamicChildren, dynamicChildren, el, parentComponent, parentSuspense, areChildrenSVG);
                        if ( parentComponent && parentComponent.type.__hmrId) {
                            traverseStaticChildren(n1, n2);
                        }
                    }
                    else if (!optimized) {
                        // full diff
                        patchChildren(n1, n2, el, null, parentComponent, parentSuspense, areChildrenSVG);
                    }
                    if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
                        queuePostRenderEffect(() => {
                            vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
                            dirs && invokeDirectiveHook(n2, n1, parentComponent, 'updated');
                        }, parentSuspense);
                    }
                };

        const processComponent = (n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized) => {
            if (n1 == null) {
                if (n2.shapeFlag & 512 /* COMPONENT_KEPT_ALIVE */) {
                    parentComponent.ctx.activate(n2, container, anchor, isSVG, optimized);
                }
                else {
                    mountComponent(n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
                }
            }
            else {
                updateComponent(n1, n2, optimized);
            }
        };


                const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, isSVG, optimized) => {
                    const instance = (initialVNode.component = createComponentInstance(initialVNode, parentComponent, parentSuspense));
                    if ( instance.type.__hmrId) {
                        registerHMR(instance);
                    }
                    {
                        pushWarningContext(initialVNode);
                        startMeasure(instance, `mount`);
                    }
                    // inject renderer internals for keepAlive
                    if (isKeepAlive(initialVNode)) {
                        instance.ctx.renderer = internals;
                    }
                    // resolve props and slots for setup context
                    {
                        startMeasure(instance, `init`);
                    }
                    setupComponent(instance);
                    {
                        endMeasure(instance, `init`);
                    }
                    // setup() is async. This component relies on async logic to be resolved
                    // before proceeding
                    if ( instance.asyncDep) {
                        parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect);
                        // Give it a placeholder if this is not hydration
                        // TODO handle self-defined fallback
                        if (!initialVNode.el) {
                            const placeholder = (instance.subTree = createVNode(Comment));
                            processCommentNode(null, placeholder, container, anchor);
                        }
                        return;
                    }
                    // setupRenderEffect(instance, initialVNode, container, anchor, parentSuspense, isSVG, optimized);
                    setupRenderEffect(instance, initialVNode, container, anchor, parentSuspense, isSVG, optimized);
                    {
                        popWarningContext();
                        endMeasure(instance, `mount`);
                    }
                };

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
                            // dev only
                            function exposePropsOnRenderContext(instance) {
                                const { ctx, propsOptions: [propsOptions] } = instance;
                                if (propsOptions) {
                                    Object.keys(propsOptions).forEach(key => {
                                        Object.defineProperty(ctx, key, {
                                            enumerable: true,
                                            configurable: true,
                                            get: () => instance.props[key],
                                            set: NOOP
                                        });
                                    });
                                }
                            }

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

                                // Return a reactive-copy of the original object, where only the root level
                                // properties are readonly, and does NOT unwrap refs nor recursively convert
                                // returned properties.
                                // This is used for creating the props proxy object for stateful components.
                                function shallowReadonly(target) {
                                    return createReactiveObject(target, true, shallowReadonlyHandlers, readonlyCollectionHandlers);
                                }
                                        const shallowReadonlyHandlers = extend({}, readonlyHandlers, {
                                            get: shallowReadonlyGet
                                        });
                                        const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true);
                                        const readonlyHandlers = {
                                            get: readonlyGet,
                                            set(target, key) {
                                                {
                                                    console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
                                                }
                                                return true;
                                            },
                                            deleteProperty(target, key) {
                                                {
                                                    console.warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target);
                                                }
                                                return true;
                                            }
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
                                                        function readonly(target) {
                                                            return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers);
                                                        }
                                                        function reactive(target) {
                                                            // if trying to observe a readonly proxy, return the readonly version.
                                                            if (target && target["__v_isReadonly" /* IS_READONLY */]) {
                                                                return target;
                                                            }
                                                            return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers);
                                                        }
                                                        const isObject = (val) => val !== null && typeof val === 'object';
                                                        function isRef(r) {
                                                            return Boolean(r && r.__v_isRef === true);
                                                        }


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

                                        const readonlyCollectionHandlers = {
                                            get: createInstrumentationGetter(true, false)
                                        };

                                        function createInstrumentationGetter(isReadonly, shallow) {
                                            const instrumentations = shallow
                                                ? shallowInstrumentations
                                                : isReadonly
                                                    ? readonlyInstrumentations
                                                    : mutableInstrumentations;
                                            return (target, key, receiver) => {
                                                if (key === "__v_isReactive" /* IS_REACTIVE */) {
                                                    return !isReadonly;
                                                }
                                                else if (key === "__v_isReadonly" /* IS_READONLY */) {
                                                    return isReadonly;
                                                }
                                                else if (key === "__v_raw" /* RAW */) {
                                                    return target;
                                                }
                                                return Reflect.get(hasOwn(instrumentations, key) && key in target
                                                    ? instrumentations
                                                    : target, key, receiver);
                                            };
                                        }
                                                const shallowInstrumentations = {
                                                    get(key) {
                                                        return get$1(this, key, false, true);
                                                    },
                                                    get size() {
                                                        return size(this);
                                                    },
                                                    has: has$1,
                                                    add,
                                                    set: set$1,
                                                    delete: deleteEntry,
                                                    clear,
                                                    forEach: createForEach(false, true)
                                                };
                                                const readonlyInstrumentations = {
                                                    get(key) {
                                                        return get$1(this, key, true);
                                                    },
                                                    get size() {
                                                        return size(this, true);
                                                    },
                                                    has(key) {
                                                        return has$1.call(this, key, true);
                                                    },
                                                    add: createReadonlyMethod("add" /* ADD */),
                                                    set: createReadonlyMethod("set" /* SET */),
                                                    delete: createReadonlyMethod("delete" /* DELETE */),
                                                    clear: createReadonlyMethod("clear" /* CLEAR */),
                                                    forEach: createForEach(true, false)
                                                };
                                                const mutableInstrumentations = {
                                                    get(key) {
                                                        return get$1(this, key);
                                                    },
                                                    get size() {
                                                        return size(this);
                                                    },
                                                    has: has$1,
                                                    add,
                                                    set: set$1,
                                                    delete: deleteEntry,
                                                    clear,
                                                    forEach: createForEach(false, false)
                                                };


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
                                                function getTargetType(value) {
                                                    return value["__v_skip" /* SKIP */] || !Object.isExtensible(value)
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
                                                const toTypeString = (value) => objectToString.call(value);
                                                const toRawType = (value) => {
                                                    return toTypeString(value).slice(8, -1);
                                                };

                                        const readonlyHandlers = {
                                            get: readonlyGet,
                                            set(target, key) {
                                                {
                                                    console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
                                                }
                                                return true;
                                            },
                                            deleteProperty(target, key) {
                                                {
                                                    console.warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target);
                                                }
                                                return true;
                                            }
                                        };


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
                                PublicInstanceProxyHandlers.ownKeys = (target) => {
                                    warn(`Avoid app logic that relies on enumerating keys on a component instance. ` +
                                        `The keys will be empty in production mode to avoid performance overhead.`);
                                    return Reflect.ownKeys(target);
                                };
                                const RuntimeCompiledPublicInstanceProxyHandlers = extend({}, PublicInstanceProxyHandlers, {
                                    get(target, key) {
                                        // fast path for unscopables when using `with` block
                                        if (key === Symbol.unscopables) {
                                            return;
                                        }
                                        return PublicInstanceProxyHandlers.get(target, key, target);
                                    },
                                    has(_, key) {
                                        const has = key[0] !== '_' && !isGloballyWhitelisted(key);
                                        if ( !has && PublicInstanceProxyHandlers.has(_, key)) {
                                            warn(`Property ${JSON.stringify(key)} should not start with _ which is a reserved prefix for Vue internals.`);
                                        }
                                        return has;
                                    }
                                });

                            function proxyRefs(objectWithRefs) {
                                return isReactive(objectWithRefs)
                                    ? objectWithRefs
                                    : new Proxy(objectWithRefs, shallowUnwrapHandlers);
                            }
                                function unref(ref) {
                                    return isRef(ref) ? ref.value : ref;
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

                            function toRaw(observed) {
                                return ((observed && toRaw(observed["__v_raw" /* RAW */])) || observed);
                            }
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

                                    function callSyncHook(name, options, ctx, globalMixins) {
                                        callHookFromMixins(name, globalMixins, ctx);
                                        const { extends: base, mixins } = options;
                                        if (base) {
                                            callHookFromExtends(name, base, ctx);
                                        }
                                        if (mixins) {
                                            callHookFromMixins(name, mixins, ctx);
                                        }
                                        const selfHook = options[name];
                                        if (selfHook) {
                                            selfHook.call(ctx);
                                        }
                                    }


                            function applyOptions(instance, options, deferredData = [], deferredWatch = [], asMixin = false) {
                                const { 
                                // composition
                                mixins, extends: extendsOptions, 
                                // state
                                data: dataOptions, computed: computedOptions, methods, watch: watchOptions, provide: provideOptions, inject: injectOptions, 
                                // assets
                                components, directives, 
                                // lifecycle
                                beforeMount, mounted, beforeUpdate, updated, activated, deactivated, beforeDestroy, beforeUnmount, destroyed, unmounted, 
                                render, renderTracked, renderTriggered, errorCaptured } = options;

                                const publicThis = instance.proxy;
                                const ctx = instance.ctx;
                                const globalMixins = instance.appContext.mixins;
                                if (asMixin && render && instance.render === NOOP) {
                                    instance.render = render;
                                }
                                // applyOptions is called non-as-mixin once per instance
                                if (!asMixin) {
                                    isInBeforeCreate = true;
                                    callSyncHook('beforeCreate', options, publicThis, globalMixins);
                                    isInBeforeCreate = false;
                                    // global mixins are applied first
                                    applyMixins(instance, globalMixins, deferredData, deferredWatch);
                                }
                                // extending a base component...
                                if (extendsOptions) {
                                    applyOptions(instance, extendsOptions, deferredData, deferredWatch, true);
                                }
                                // local mixins
                                if (mixins) {
                                    applyMixins(instance, mixins, deferredData, deferredWatch);
                                }
                                const checkDuplicateProperties =  createDuplicateChecker() ;
                                {
                                    const [propsOptions] = instance.propsOptions;
                                    if (propsOptions) {
                                        for (const key in propsOptions) {
                                            checkDuplicateProperties("Props" /* PROPS */, key);
                                        }
                                    }
                                }
                                // options initialization order (to be consistent with Vue 2):
                                // - props (already done outside of this function)
                                // - inject
                                // - methods
                                // - data (deferred since it relies on `this` access)
                                // - computed
                                // - watch (deferred since it relies on `this` access)
                                if (injectOptions) {
                                    if (isArray(injectOptions)) {
                                        for (let i = 0; i < injectOptions.length; i++) {
                                            const key = injectOptions[i];
                                            ctx[key] = inject(key);
                                            {
                                                checkDuplicateProperties("Inject" /* INJECT */, key);
                                            }
                                        }
                                    }
                                    else {
                                        for (const key in injectOptions) {
                                            const opt = injectOptions[key];
                                            if (isObject(opt)) {
                                                ctx[key] = inject(opt.from || key, opt.default, true /* treat default function as factory */);
                                            }
                                            else {
                                                ctx[key] = inject(opt);
                                            }
                                            {
                                                checkDuplicateProperties("Inject" /* INJECT */, key);
                                            }
                                        }
                                    }
                                }
                                if (methods) {
                                    for (const key in methods) {
                                        const methodHandler = methods[key];
                                        if (isFunction(methodHandler)) {
                                            ctx[key] = methodHandler.bind(publicThis);
                                            {
                                                checkDuplicateProperties("Methods" /* METHODS */, key);
                                            }
                                        }
                                        else {
                                            warn(`Method "${key}" has type "${typeof methodHandler}" in the component definition. ` +
                                                `Did you reference the function correctly?`);
                                        }
                                    }
                                }
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
                                if (provideOptions) {
                                    const provides = isFunction(provideOptions)
                                        ? provideOptions.call(publicThis)
                                        : provideOptions;
                                    for (const key in provides) {
                                        provide(key, provides[key]);
                                    }
                                }
                                // asset options.
                                // To reduce memory usage, only components with mixins or extends will have
                                // resolved asset registry attached to instance.
                                if (asMixin) {
                                    if (components) {
                                        extend(instance.components ||
                                            (instance.components = extend({}, instance.type.components)), components);
                                    }
                                    if (directives) {
                                        extend(instance.directives ||
                                            (instance.directives = extend({}, instance.type.directives)), directives);
                                    }
                                }
                                // lifecycle options
                                if (!asMixin) {
                                    callSyncHook('created', options, publicThis, globalMixins);
                                }
                                if (beforeMount) {
                                    onBeforeMount(beforeMount.bind(publicThis));
                                }
                                if (mounted) {
                                    onMounted(mounted.bind(publicThis));
                                }
                                if (beforeUpdate) {
                                    onBeforeUpdate(beforeUpdate.bind(publicThis));
                                }
                                if (updated) {
                                    onUpdated(updated.bind(publicThis));
                                }
                                if (activated) {
                                    onActivated(activated.bind(publicThis));
                                }
                                if (deactivated) {
                                    onDeactivated(deactivated.bind(publicThis));
                                }
                                if (errorCaptured) {
                                    onErrorCaptured(errorCaptured.bind(publicThis));
                                }
                                if (renderTracked) {
                                    onRenderTracked(renderTracked.bind(publicThis));
                                }
                                if (renderTriggered) {
                                    onRenderTriggered(renderTriggered.bind(publicThis));
                                }
                                if ( beforeDestroy) {
                                    warn(`\`beforeDestroy\` has been renamed to \`beforeUnmount\`.`);
                                }
                                if (beforeUnmount) {
                                    onBeforeUnmount(beforeUnmount.bind(publicThis));
                                }
                                if ( destroyed) {
                                    warn(`\`destroyed\` has been renamed to \`unmounted\`.`);
                                }
                                if (unmounted) {
                                    onUnmounted(unmounted.bind(publicThis));
                                }
                            }
                                function applyMixins(instance, mixins, deferredData, deferredWatch) {
                                    for (let i = 0; i < mixins.length; i++) {
                                        applyOptions(instance, mixins[i], deferredData, deferredWatch, true);
                                    }
                                }

                                function createDuplicateChecker() {
                                    const cache = Object.create(null);
                                    return (type, key) => {
                                        if (cache[key]) {
                                            warn(`${type} property "${key}" is already defined in ${cache[key]}.`);
                                        }
                                        else {
                                            cache[key] = type;
                                        }
                                    };
                                }

                                function inject(key, defaultValue, treatDefaultAsFactory = false) {
                                    // fallback to `currentRenderingInstance` so that this can be called in
                                    // a functional component
                                    const instance = currentInstance || currentRenderingInstance;
                                    if (instance) {
                                        const provides = instance.provides;
                                        if (key in provides) {
                                            // TS doesn't allow symbol as index type
                                            return provides[key];
                                        }
                                        else if (arguments.length > 1) {
                                            return treatDefaultAsFactory && isFunction(defaultValue)
                                                ? defaultValue()
                                                : defaultValue;
                                        }
                                        else {
                                            warn(`injection "${String(key)}" not found.`);
                                        }
                                    }
                                    else {
                                        warn(`inject() can only be used inside setup() or functional components.`);
                                    }
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
                                function computed$1(getterOrOptions) {
                                    const c = computed(getterOrOptions);
                                    recordInstanceBoundEffect(c.effect);
                                    return c;
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

                        function registerHMR(instance) {
                            const id = instance.type.__hmrId;
                            let record = map.get(id);
                            if (!record) {
                                createRecord(id);
                                record = map.get(id);
                            }
                            record.add(instance);
                        }
                        function createRecord(id) {
                            if (map.has(id)) {
                                return false;
                            }
                            map.set(id, new Set());
                            return true;
                        }
                        function startMeasure(instance, type) {
                            if (instance.appContext.config.performance && isSupported()) {
                                perf.mark(`vue-${type}-${instance.uid}`);
                            }
                        }
                        function endMeasure(instance, type) {
                            if (instance.appContext.config.performance && isSupported()) {
                                const startTag = `vue-${type}-${instance.uid}`;
                                const endTag = startTag + `:end`;
                                perf.mark(endTag);
                                perf.measure(`<${formatComponentName(instance, instance.type)}> ${type}`, startTag, endTag);
                                perf.clearMarks(startTag);
                                perf.clearMarks(endTag);
                            }
                        }



/*
* updateComponent
*/

const updateComponent = (n1, n2, optimized) => {
    const instance = (n2.component = n1.component);
    if (shouldUpdateComponent(n1, n2, optimized)) {
        if (
            instance.asyncDep &&
            !instance.asyncResolved) {
            // async & still pending - just update props and slots
            // since the component's reactive effect for render isn't set-up yet
            {
                pushWarningContext(n2);
            }
            updateComponentPreRender(instance, n2, optimized);
            {
                popWarningContext();
            }
            return;
        }
        else {
            // normal update
            instance.next = n2;
            // in case the child component is also queued, remove it to avoid
            // double updating the same child component in the same flush.
            invalidateJob(instance.update);
            // instance.update is the reactive effect runner.
            instance.update();
        }
    }
    else {
        // no update needed. just copy over properties
        n2.component = n1.component;
        n2.el = n1.el;
        instance.vnode = n2;
    }
};


    function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
        const { props: prevProps, children: prevChildren, component } = prevVNode;
        const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
        const emits = component.emitsOptions;
        // Parent component's render function was hot-updated. Since this may have
        // caused the child component's slots content to have changed, we need to
        // force the child to update as well.
        if ( (prevChildren || nextChildren) && isHmrUpdating) {
            return true;
        }
        // force child update for runtime directive or transition on component vnode.
        if (nextVNode.dirs || nextVNode.transition) {
            return true;
        }
        if (optimized && patchFlag > 0) {
            if (patchFlag & 1024 /* DYNAMIC_SLOTS */) {
                // slot content that references values that might have changed,
                // e.g. in a v-for
                return true;
            }

            /*
            *function buildProps(node, context, props = node.props, ssr = false) 
            *
            * if (hasDynamicKeys) {
            *    patchFlag |= 16 // FULL_PROPS
            * }
            * if (dynamicPropNames.length) {
            *        patchFlag |= 8 // PROPS
            * }
            */

            if (patchFlag & 16 /* FULL_PROPS */) {
                if (!prevProps) {
                    return !!nextProps;
                }
                // presence of this flag indicates props are always non-null
                return hasPropsChanged(prevProps, nextProps, emits);
            }
            else if (patchFlag & 8 /* PROPS */) {
                const dynamicProps = nextVNode.dynamicProps;
                for (let i = 0; i < dynamicProps.length; i++) {
                    const key = dynamicProps[i];
                    if (nextProps[key] !== prevProps[key] &&
                        !isEmitListener(emits, key)) {
                        return true;
                    }
                }
            }
        }
        else {
            // this path is only taken by manually written render functions
            // so presence of any children leads to a forced update
            if (prevChildren || nextChildren) {
                if (!nextChildren || !nextChildren.$stable) {
                    return true;
                }
            }
            if (prevProps === nextProps) {
                return false;
            }
            if (!prevProps) {
                return !!nextProps;
            }
            if (!nextProps) {
                return true;
            }
            return hasPropsChanged(prevProps, nextProps, emits);
        }
        return false;
    }

    function hasPropsChanged(prevProps, nextProps, emitsOptions) {
        const nextKeys = Object.keys(nextProps);
        if (nextKeys.length !== Object.keys(prevProps).length) {
            return true;
        }
        for (let i = 0; i < nextKeys.length; i++) {
            const key = nextKeys[i];
            if (nextProps[key] !== prevProps[key] &&
                !isEmitListener(emitsOptions, key)) {
                return true;
            }
        }
        return false;
    }

    // Check if an incoming prop key is a declared emit event listener.
    // e.g. With `emits: { click: null }`, props named `onClick` and `onclick` are
    // both considered matched listeners.
    function isEmitListener(options, key) {
        if (!options || !isOn(key)) {
            return false;
        }
        key = key.replace(/Once$/, '');
        return (hasOwn(options, key[2].toLowerCase() + key.slice(3)) ||
            hasOwn(options, key.slice(2)));
    }


    function invalidateJob(job) {
        const i = queue.indexOf(job);
        if (i > -1) {
            queue[i] = null;
        }
    }


