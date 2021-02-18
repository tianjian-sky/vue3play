/**
         * 
         * node.type:0 ROOT 1 ELEMENT 2 TEXT 3 COMMENT 4 SIMPLE_EXPRESSION  5 INTERPOLATION 8 COMPOUND_EXPRESSION 9 IF 10 IF_BRANCH IF 11 FOR 12 TEXT_CALL
         * 
         * static type 0 NOT_STATIC 1 FULL_STATIC  2 HAS_RUNTIME_CONSTANT
         * tagtype: 0 element 1 template 2 slot
         * 
         * codegennode.patchFlag 
         * -2 BAIL
         * -1 HOISTED 
         * 1 TEXT 
         * 2 CLASS 
         * 4 STYLE 
         * 8 PROPS 
         * 16 FULL_PROPS 
         * 32 HYDRATE_EVENTS 
         * 64 STABLE_FRAGMENT 
         * 128 KEYED_FRAGMENT 
         * 256 UNKEYED_FRAGMENT 
         * 512 NEED_PATCH 
         * 1024 DYNAMIC_SLOTS
         * 
         */





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

const patchChildren = (n1, n2, container, anchor, parentComponent, parentSuspense, isSVG, optimized = false) => {
    const c1 = n1 && n1.children;
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;
    const c2 = n2.children;
    const { patchFlag, shapeFlag } = n2;
    // fast path
    if (patchFlag > 0) {
        if (patchFlag & 128 /* KEYED_FRAGMENT */) {
            // this could be either fully-keyed or mixed (some keyed some not)
            // presence of patchFlag means children are guaranteed to be arrays
            patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
            return;
        }
        else if (patchFlag & 256 /* UNKEYED_FRAGMENT */) {
            // unkeyed
            patchUnkeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
            return;
        }
    }
    // children has 3 possibilities: text, array or no children.
    if (shapeFlag & 8 /* TEXT_CHILDREN */) {
        // text children fast path
        if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
            unmountChildren(c1, parentComponent, parentSuspense);
        }
        if (c2 !== c1) {
            hostSetElementText(container, c2);
        }
    }
    else {
        if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
            // prev children was array
            if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                // two arrays, cannot assume anything, do full diff
                patchKeyedChildren(c1, c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
            }
            else {
                // no new children, just unmount old
                unmountChildren(c1, parentComponent, parentSuspense, true);
            }
        }
        else {
            // prev children was text OR null
            // new children is array OR null
            if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
                hostSetElementText(container, '');
            }
            // mount new if array
            if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                mountChildren(c2, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
            }
        }
    }
};

// optimized normalization for template-compiled render fns
function cloneIfMounted(child) {
    return child.el === null ? child : cloneVNode(child);
}
function isSameVNodeType(n1, n2) {
    if (
        n2.shapeFlag & 6 /* COMPONENT */ &&
        hmrDirtyComponents.has(n2.type)) {
        // HMR only: if the component has been hot-updated, force a reload.
        return false;
    }
    return n1.type === n2.type && n1.key === n2.key;
}
// can be all-keyed or mixed
const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent, parentSuspense, isSVG, optimized) => {
    let i = 0;
    const l2 = c2.length;
    let e1 = c1.length - 1; // prev ending index
    let e2 = l2 - 1; // next ending index
    // 1. sync from start
    // (a b) c
    // (a b) d e
    while (i <= e1 && i <= e2) {
        const n1 = c1[i];
        const n2 = (c2[i] = optimized
            ? cloneIfMounted(c2[i])
            : normalizeVNode(c2[i]));
        if (isSameVNodeType(n1, n2)) {
            patch(n1, n2, container, null, parentComponent, parentSuspense, isSVG, optimized);
        }
        else {
            break;
        }
        i++;
    }
    // 2. sync from end
    // a (b c)
    // d e (b c)
    while (i <= e1 && i <= e2) {
        const n1 = c1[e1];
        const n2 = (c2[e2] = optimized
            ? cloneIfMounted(c2[e2])
            : normalizeVNode(c2[e2]));
        if (isSameVNodeType(n1, n2)) {
            patch(n1, n2, container, null, parentComponent, parentSuspense, isSVG, optimized);
        }
        else {
            break;
        }
        e1--;
        e2--;
    }
    // 3. common sequence + mount
    // (a b)
    // (a b) c
    // i = 2, e1 = 1, e2 = 2
    // (a b)
    // c (a b)
    // i = 0, e1 = -1, e2 = 0
    if (i > e1) {
        if (i <= e2) {
            const nextPos = e2 + 1;
            const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
            while (i <= e2) {
                patch(null, (c2[i] = optimized
                    ? cloneIfMounted(c2[i])
                    : normalizeVNode(c2[i])), container, anchor, parentComponent, parentSuspense, isSVG);
                i++;
            }
        }
    }
    // 4. common sequence + unmount
    // (a b) c
    // (a b)
    // i = 2, e1 = 2, e2 = 1
    // a (b c)
    // (b c)
    // i = 0, e1 = 0, e2 = -1
    else if (i > e2) {
        while (i <= e1) {
            unmount(c1[i], parentComponent, parentSuspense, true);
            i++;
        }
    }
    // 5. unknown sequence
    // [i ... e1 + 1]: a b [c d e] f g
    // [i ... e2 + 1]: a b [e d c h] f g
    // i = 2, e1 = 4, e2 = 5
    else {
        const s1 = i; // prev starting index
        const s2 = i; // next starting index
        // 5.1 build key:index map for newChildren
        const keyToNewIndexMap = new Map();
        for (i = s2; i <= e2; i++) {
            const nextChild = (c2[i] = optimized
                ? cloneIfMounted(c2[i])
                : normalizeVNode(c2[i]));
            if (nextChild.key != null) {
                if ( keyToNewIndexMap.has(nextChild.key)) {
                    warn(`Duplicate keys found during update:`, JSON.stringify(nextChild.key), `Make sure keys are unique.`);
                }
                keyToNewIndexMap.set(nextChild.key, i);
            }
        }
        // 5.2 loop through old children left to be patched and try to patch
        // matching nodes & remove nodes that are no longer present
        let j;
        let patched = 0;
        const toBePatched = e2 - s2 + 1;
        let moved = false;
        // used to track whether any node has moved
        let maxNewIndexSoFar = 0;
        // works as Map<newIndex, oldIndex>
        // Note that oldIndex is offset by +1
        // and oldIndex = 0 is a special value indicating the new node has
        // no corresponding old node.
        // used for determining longest stable subsequence
        const newIndexToOldIndexMap = new Array(toBePatched);
        for (i = 0; i < toBePatched; i++)
            newIndexToOldIndexMap[i] = 0;
        for (i = s1; i <= e1; i++) {
            const prevChild = c1[i];
            if (patched >= toBePatched) {
                // all new children have been patched so this can only be a removal
                unmount(prevChild, parentComponent, parentSuspense, true);
                continue;
            }
            let newIndex;
            if (prevChild.key != null) {
                newIndex = keyToNewIndexMap.get(prevChild.key);
            }
            else {
                // key-less node, try to locate a key-less node of the same type
                for (j = s2; j <= e2; j++) {
                    if (newIndexToOldIndexMap[j - s2] === 0 &&
                        isSameVNodeType(prevChild, c2[j])) {
                        newIndex = j;
                        break;
                    }
                }
            }
            if (newIndex === undefined) {
                unmount(prevChild, parentComponent, parentSuspense, true);
            }
            else {
                newIndexToOldIndexMap[newIndex - s2] = i + 1; // +1 操作便于0判断
                if (newIndex >= maxNewIndexSoFar) {
                    maxNewIndexSoFar = newIndex;
                }
                else {
                    moved = true;
                }
                patch(prevChild, c2[newIndex], container, null, parentComponent, parentSuspense, isSVG, optimized);
                patched++;
            }
        }
        // 5.3 move and mount
        // generate longest stable subsequence only when nodes have moved
        const increasingNewIndexSequence = moved
            ? getSequence(newIndexToOldIndexMap) // 新的index序列里的old序列
            : EMPTY_ARR;
        j = increasingNewIndexSequence.length - 1;
        // looping backwards so that we can use last patched node as anchor
        for (i = toBePatched - 1; i >= 0; i--) {
            const nextIndex = s2 + i;
            const nextChild = c2[nextIndex];
            const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : parentAnchor;
            if (newIndexToOldIndexMap[i] === 0) {
                // mount new
                patch(null, nextChild, container, anchor, parentComponent, parentSuspense, isSVG);
            }
            else if (moved) {
                // move if:
                // There is no stable subsequence (e.g. a reverse)
                // OR current node is not among the stable sequence
                if (j < 0 || i !== increasingNewIndexSequence[j]) {
                    move(nextChild, container, anchor, 2 /* REORDER */);
                }
                else {
                    j--;
                }
            }
        }
    }
};
        // https://en.wikipedia.org/wiki/Longest_increasing_subsequence
        function getSequence(arr) {
            const p = arr.slice();
            const result = [0];
            let i, j, u, v, c;
            const len = arr.length;
            for (i = 0; i < len; i++) {
                const arrI = arr[i];
                if (arrI !== 0) {
                    j = result[result.length - 1];
                    if (arr[j] < arrI) {
                        p[i] = j;
                        result.push(i);
                        continue;
                    }
                    u = 0;
                    v = result.length - 1;
                    while (u < v) {
                        c = ((u + v) / 2) | 0;
                        if (arr[result[c]] < arrI) {
                            u = c + 1;
                        }
                        else {
                            v = c;
                        }
                    }
                    if (arrI < arr[result[u]]) {
                        if (u > 0) {
                            p[i] = result[u - 1];
                        }
                        result[u] = i;
                    }
                }
            }
            u = result.length;
            v = result[u - 1];
            while (u-- > 0) {
                result[u] = v;
                v = p[v];
            }
            return result;
        }


        const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
            const { el, type, transition, children, shapeFlag } = vnode;
            if (shapeFlag & 6 /* COMPONENT */) {
                move(vnode.component.subTree, container, anchor, moveType);
                return;
            }
            if ( shapeFlag & 128 /* SUSPENSE */) {
                vnode.suspense.move(container, anchor, moveType);
                return;
            }
            if (shapeFlag & 64 /* TELEPORT */) {
                type.move(vnode, container, anchor, internals);
                return;
            }
            if (type === Fragment) {
                hostInsert(el, container, anchor);
                for (let i = 0; i < children.length; i++) {
                    move(children[i], container, anchor, moveType);
                }
                hostInsert(vnode.anchor, container, anchor);
                return;
            }
            // static node move can only happen when force updating HMR
            if ( type === Static) {
                moveStaticNode(vnode, container, anchor);
                return;
            }
            // single nodes
            const needTransition = moveType !== 2 /* REORDER */ &&
                shapeFlag & 1 /* ELEMENT */ &&
                transition;
            if (needTransition) {
                if (moveType === 0 /* ENTER */) {
                    transition.beforeEnter(el);
                    hostInsert(el, container, anchor);
                    queuePostRenderEffect(() => transition.enter(el), parentSuspense);
                }
                else {
                    const { leave, delayLeave, afterLeave } = transition;
                    const remove = () => hostInsert(el, container, anchor);
                    const performLeave = () => {
                        leave(el, () => {
                            remove();
                            afterLeave && afterLeave();
                        });
                    };
                    if (delayLeave) {
                        delayLeave(el, remove, performLeave);
                    }
                    else {
                        performLeave();
                    }
                }
            }
            else {
                hostInsert(el, container, anchor);
            }
        };

            /**
             * Dev / HMR only
             */
            const moveStaticNode = (vnode, container, anchor) => {
                let cur = vnode.el;
                const end = vnode.anchor;
                while (cur && cur !== end) {
                    const next = hostNextSibling(cur);
                    hostInsert(cur, container, anchor);
                    cur = next;
                }
                hostInsert(end, container, anchor);
            };

const unmount = (vnode, parentComponent, parentSuspense, doRemove = false) => {
    const { type, props, ref, children, dynamicChildren, shapeFlag, patchFlag, dirs } = vnode;
    // unset ref
    if (ref != null && parentComponent) {
        setRef(ref, null, parentComponent, parentSuspense, null);
    }
    if (shapeFlag & 256 /* COMPONENT_SHOULD_KEEP_ALIVE */) {
        parentComponent.ctx.deactivate(vnode);
        return;
    }
    const shouldInvokeDirs = shapeFlag & 1 /* ELEMENT */ && dirs;
    let vnodeHook;
    if ((vnodeHook = props && props.onVnodeBeforeUnmount)) {
        invokeVNodeHook(vnodeHook, parentComponent, vnode);
    }
    if (shapeFlag & 6 /* COMPONENT */) {
        unmountComponent(vnode.component, parentSuspense, doRemove);
    }
    else {
        if ( shapeFlag & 128 /* SUSPENSE */) {
            vnode.suspense.unmount(parentSuspense, doRemove);
            return;
        }
        if (shouldInvokeDirs) {
            invokeDirectiveHook(vnode, null, parentComponent, 'beforeUnmount');
        }
        if (dynamicChildren &&
            // #1153: fast path should not be taken for non-stable (v-for) fragments
            (type !== Fragment ||
                (patchFlag > 0 && patchFlag & 64 /* STABLE_FRAGMENT */))) {
            // fast path for block nodes: only need to unmount dynamic children.
            unmountChildren(dynamicChildren, parentComponent, parentSuspense);
        }
        else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
            unmountChildren(children, parentComponent, parentSuspense);
        }
        // an unmounted teleport should always remove its children
        if (shapeFlag & 64 /* TELEPORT */) {
            vnode.type.remove(vnode, internals);
        }
        if (doRemove) {
            remove(vnode);
        }
    }
    if ((vnodeHook = props && props.onVnodeUnmounted) || shouldInvokeDirs) {
        queuePostRenderEffect(() => {
            vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
            shouldInvokeDirs &&
                invokeDirectiveHook(vnode, null, parentComponent, 'unmounted');
        }, parentSuspense);
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
        function invokeDirectiveHook(vnode, prevVNode, instance, name) {
            const bindings = vnode.dirs;
            const oldBindings = prevVNode && prevVNode.dirs;
            for (let i = 0; i < bindings.length; i++) {
                const binding = bindings[i];
                if (oldBindings) {
                    binding.oldValue = oldBindings[i].value;
                }
                const hook = binding.dir[name];
                if (hook) {
                    callWithAsyncErrorHandling(hook, instance, 8 /* DIRECTIVE_HOOK */, [
                        vnode.el,
                        binding,
                        vnode,
                        prevVNode
                    ]);
                }
            }
        }
        function callWithAsyncErrorHandling(fn, instance, type, args) {
            if (isFunction(fn)) {
                const res = callWithErrorHandling(fn, instance, type, args);
                if (res && isPromise(res)) {
                    res.catch(err => {
                        handleError(err, instance, type);
                    });
                }
                return res;
            }
            const values = [];
            for (let i = 0; i < fn.length; i++) {
                values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
            }
            return values;
        }
        const mountChildren = (children, container, anchor, parentComponent, parentSuspense, isSVG, optimized, start = 0) => {
            for (let i = start; i < children.length; i++) {
                const child = (children[i] = optimized
                    ? cloneIfMounted(children[i])
                    : normalizeVNode(children[i]));
                patch(null, child, container, anchor, parentComponent, parentSuspense, isSVG, optimized);
            }
        };
        const setScopeId = (el, scopeId, vnode, parentComponent) => {
            if (scopeId) {
                hostSetScopeId(el, scopeId);
            }
            if (parentComponent) {
                const treeOwnerId = parentComponent.type.__scopeId;
                // vnode's own scopeId and the current patched component's scopeId is
                // different - this is a slot content node.
                if (treeOwnerId && treeOwnerId !== scopeId) {
                    hostSetScopeId(el, treeOwnerId + '-s');
                }
                let subTree = parentComponent.subTree;
                if ( subTree.type === Fragment) {
                    subTree =
                        filterSingleRoot(subTree.children) || subTree;
                }
                if (vnode === subTree) {
                    setScopeId(el, parentComponent.vnode.scopeId, parentComponent.vnode, parentComponent.parent);
                }
            }
        };
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
                function queueJob(job) {
                    // the dedupe search uses the startIndex argument of Array.includes()
                    // by default the search index includes the current job that is being run
                    // so it cannot recursively trigger itself again.
                    // if the job is a watch() callback, the search will start with a +1 index to
                    // allow it recursively trigger itself - it is the user's responsibility to
                    // ensure it doesn't end up in an infinite loop.
                    if ((!queue.length ||
                        !queue.includes(job, isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex)) &&
                        job !== currentPreFlushParentJob) {
                        queue.push(job);
                        queueFlush();
                    }
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
                function checkRecursiveUpdates(seen, fn) {
                    if (!seen.has(fn)) {
                        seen.set(fn, 1);
                    }
                    else {
                        const count = seen.get(fn);
                        if (count > RECURSION_LIMIT) {
                            throw new Error(`Maximum recursive updates exceeded. ` +
                                `This means you have a reactive effect that is mutating its own ` +
                                `dependencies and thus recursively triggering itself. Possible sources ` +
                                `include component template, render function, updated hook or ` +
                                `watcher source function.`);
                        }
                        else {
                            seen.set(fn, count + 1);
                        }
                    }
                }
        function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
            callWithAsyncErrorHandling(hook, instance, 7 /* VNODE_HOOK */, [
                vnode,
                prevVNode
            ]);
        }
        function invokeDirectiveHook(vnode, prevVNode, instance, name) {
            const bindings = vnode.dirs;
            const oldBindings = prevVNode && prevVNode.dirs;
            for (let i = 0; i < bindings.length; i++) {
                const binding = bindings[i];
                if (oldBindings) {
                    binding.oldValue = oldBindings[i].value;
                }
                const hook = binding.dir[name];
                if (hook) {
                    callWithAsyncErrorHandling(hook, instance, 8 /* DIRECTIVE_HOOK */, [
                        vnode.el,
                        binding,
                        vnode,
                        prevVNode
                    ]);
                }
            }
        }
        const patchProp = (el, key, prevValue, nextValue, isSVG = false, prevChildren, parentComponent, parentSuspense, unmountChildren) => {
            switch (key) {
                // special
                case 'class':
                    patchClass(el, nextValue, isSVG);
                    break;
                case 'style':
                    patchStyle(el, prevValue, nextValue);
                    break;
                default:
                    if (isOn(key)) {
                        // ignore v-model listeners
                        if (!isModelListener(key)) {
                            patchEvent(el, key, prevValue, nextValue, parentComponent);
                        }
                    }
                    else if (shouldSetAsProp(el, key, nextValue, isSVG)) {
                        patchDOMProp(el, key, nextValue, prevChildren, parentComponent, parentSuspense, unmountChildren);
                    }
                    else {
                        // special case for <input v-model type="checkbox"> with
                        // :true-value & :false-value
                        // store value as dom properties since non-string values will be
                        // stringified.
                        if (key === 'true-value') {
                            el._trueValue = nextValue;
                        }
                        else if (key === 'false-value') {
                            el._falseValue = nextValue;
                        }
                        patchAttr(el, key, nextValue, isSVG);
                    }
                    break;
            }
        };

            // compiler should normalize class + :class bindings on the same element
            // into a single binding ['staticClass', dynamic]
            function patchClass(el, value, isSVG) {
                if (value == null) {
                    value = '';
                }
                if (isSVG) {
                    el.setAttribute('class', value);
                }
                else {
                    // directly setting className should be faster than setAttribute in theory
                    // if this is an element during a transition, take the temporary transition
                    // classes into account.
                    const transitionClasses = el._vtc;
                    if (transitionClasses) {
                        value = (value
                            ? [value, ...transitionClasses]
                            : [...transitionClasses]).join(' ');
                    }
                    el.className = value;
                }
            }

            function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
                // vei = vue event invokers
                const invokers = el._vei || (el._vei = {});
                const existingInvoker = invokers[rawName];
                if (nextValue && existingInvoker) {
                    // patch
                    existingInvoker.value = nextValue;
                }
                else {
                    const [name, options] = parseName(rawName);
                    if (nextValue) {
                        // add
                        const invoker = (invokers[rawName] = createInvoker(nextValue, instance));
                        addEventListener(el, name, invoker, options);
                    }
                    else if (existingInvoker) {
                        // remove
                        removeEventListener(el, name, existingInvoker, options);
                        invokers[rawName] = undefined;
                    }
                }
            }
            function createInvoker(initialValue, instance) {
                const invoker = (e) => {
                    // async edge case #6566: inner click event triggers patch, event handler
                    // attached to outer element during patch, and triggered again. This
                    // happens because browsers fire microtask ticks between event propagation.
                    // the solution is simple: we save the timestamp when a handler is attached,
                    // and the handler would only fire if the event passed to it was fired
                    // AFTER it was attached.
                    const timeStamp = e.timeStamp || _getNow();
                    if (timeStamp >= invoker.attached - 1) {
                        callWithAsyncErrorHandling(patchStopImmediatePropagation(e, invoker.value), instance, 5 /* NATIVE_EVENT_HANDLER */, [e]);
                    }
                };
                invoker.value = initialValue;
                invoker.attached = getNow();
                return invoker;
            }
            function patchStopImmediatePropagation(e, value) {
                if (isArray(value)) {
                    const originalStop = e.stopImmediatePropagation;
                    e.stopImmediatePropagation = () => {
                        originalStop.call(e);
                        e._stopped = true;
                    };
                    return value.map(fn => (e) => !e._stopped && fn(e));
                }
                else {
                    return value;
                }
            }

            function shouldSetAsProp(el, key, value, isSVG) {
                if (isSVG) {
                    // most keys must be set as attribute on svg elements to work
                    // ...except innerHTML
                    if (key === 'innerHTML') {
                        return true;
                    }
                    // or native onclick with function values
                    if (key in el && nativeOnRE.test(key) && isFunction(value)) {
                        return true;
                    }
                    return false;
                }
                // spellcheck and draggable are numerated attrs, however their
                // corresponding DOM properties are actually booleans - this leads to
                // setting it with a string "false" value leading it to be coerced to
                // `true`, so we need to always treat them as attributes.
                // Note that `contentEditable` doesn't have this problem: its DOM
                // property is also enumerated string values.
                if (key === 'spellcheck' || key === 'draggable') {
                    return false;
                }
                // #1787 form as an attribute must be a string, while it accepts an Element as
                // a prop
                if (key === 'form' && typeof value === 'string') {
                    return false;
                }
                // #1526 <input list> must be set as attribute
                if (key === 'list' && el.tagName === 'INPUT') {
                    return false;
                }
                // native onclick with string value, must be set as attribute
                if (nativeOnRE.test(key) && isString(value)) {
                    return false;
                }
                return key in el;
            }

            function patchDOMProp(el, key, value, 
                // the following args are passed only due to potential innerHTML/textContent
                // overriding existing VNodes, in which case the old tree must be properly
                // unmounted.
                prevChildren, parentComponent, parentSuspense, unmountChildren) {
                    if (key === 'innerHTML' || key === 'textContent') {
                        if (prevChildren) {
                            unmountChildren(prevChildren, parentComponent, parentSuspense);
                        }
                        el[key] = value == null ? '' : value;
                        return;
                    }
                    if (key === 'value' && el.tagName !== 'PROGRESS') {
                        // store value as _value as well since
                        // non-string values will be stringified.
                        el._value = value;
                        const newValue = value == null ? '' : value;
                        if (el.value !== newValue) {
                            el.value = newValue;
                        }
                        return;
                    }
                    if (value === '' && typeof el[key] === 'boolean') {
                        // e.g. <select multiple> compiles to { multiple: '' }
                        el[key] = true;
                    }
                    else if (value == null && typeof el[key] === 'string') {
                        // e.g. <div :id="null">
                        el[key] = '';
                        el.removeAttribute(key);
                    }
                    else {
                        // some properties perform value validation and throw
                        try {
                            el[key] = value;
                        }
                        catch (e) {
                            {
                                warn(`Failed setting prop "${key}" on <${el.tagName.toLowerCase()}>: ` +
                                    `value ${value} is invalid.`, e);
                            }
                        }
                    }
                }
                function patchAttr(el, key, value, isSVG) {
                    if (isSVG && key.startsWith('xlink:')) {
                        if (value == null) {
                            el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
                        }
                        else {
                            el.setAttributeNS(xlinkNS, key, value);
                        }
                    }
                    else {
                        // note we are only checking boolean attributes that don't have a
                        // corresponding dom prop of the same name here.
                        const isBoolean = isSpecialBooleanAttr(key);
                        if (value == null || (isBoolean && value === false)) {
                            el.removeAttribute(key);
                        }
                        else {
                            el.setAttribute(key, isBoolean ? '' : value);
                        }
                    }
                }
                const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
            const isSpecialBooleanAttr = /*#__PURE__*/ makeMap(specialBooleanAttrs);







    /*
    * 可以根据shapeFlg有选择更新，粒度更细
    */

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

            const patchProps = (el, vnode, oldProps, newProps, parentComponent, parentSuspense, isSVG) => {
                if (oldProps !== newProps) {
                    for (const key in newProps) {
                        if (isReservedProp(key))
                            continue;
                        const next = newProps[key];
                        const prev = oldProps[key];
                        if (next !== prev ||
                            (hostForcePatchProp && hostForcePatchProp(el, key))) {
                            hostPatchProp(el, key, prev, next, isSVG, vnode.children, parentComponent, parentSuspense, unmountChildren);
                        }
                    }
                    if (oldProps !== EMPTY_OBJ) {
                        for (const key in oldProps) {
                            if (!isReservedProp(key) && !(key in newProps)) {
                                hostPatchProp(el, key, oldProps[key], null, isSVG, vnode.children, parentComponent, parentSuspense, unmountChildren);
                            }
                        }
                    }
                }
            };
            const patchProp = (el, key, prevValue, nextValue, isSVG = false, prevChildren, parentComponent, parentSuspense, unmountChildren) => {
                switch (key) {
                    // special
                    case 'class':
                        patchClass(el, nextValue, isSVG);
                        break;
                    case 'style':
                        patchStyle(el, prevValue, nextValue);
                        break;
                    default:
                        if (isOn(key)) {
                            // ignore v-model listeners
                            if (!isModelListener(key)) {
                                patchEvent(el, key, prevValue, nextValue, parentComponent);
                            }
                        }
                        else if (shouldSetAsProp(el, key, nextValue, isSVG)) {
                            patchDOMProp(el, key, nextValue, prevChildren, parentComponent, parentSuspense, unmountChildren);
                        }
                        else {
                            // special case for <input v-model type="checkbox"> with
                            // :true-value & :false-value
                            // store value as dom properties since non-string values will be
                            // stringified.
                            if (key === 'true-value') {
                                el._trueValue = nextValue;
                            }
                            else if (key === 'false-value') {
                                el._falseValue = nextValue;
                            }
                            patchAttr(el, key, nextValue, isSVG);
                        }
                        break;
                }
            };




