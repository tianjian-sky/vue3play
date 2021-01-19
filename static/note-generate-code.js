const FRAGMENT = Symbol( `Fragment` );
const TELEPORT = Symbol( `Teleport` );
const SUSPENSE = Symbol( `Suspense` );
const KEEP_ALIVE = Symbol( `KeepAlive` );
const BASE_TRANSITION = Symbol( `BaseTransition` );
const OPEN_BLOCK = Symbol( `openBlock` );
const CREATE_BLOCK = Symbol( `createBlock` );
const CREATE_VNODE = Symbol( `createVNode` );
const CREATE_COMMENT = Symbol( `createCommentVNode` );
const CREATE_TEXT = Symbol( `createTextVNode` );
const CREATE_STATIC = Symbol( `createStaticVNode` );
const RESOLVE_COMPONENT = Symbol( `resolveComponent` );
const RESOLVE_DYNAMIC_COMPONENT = Symbol( `resolveDynamicComponent` );
const RESOLVE_DIRECTIVE = Symbol( `resolveDirective` );
const WITH_DIRECTIVES = Symbol( `withDirectives` );
const RENDER_LIST = Symbol( `renderList` );
const RENDER_SLOT = Symbol( `renderSlot` );
const CREATE_SLOTS = Symbol( `createSlots` );
const TO_DISPLAY_STRING = Symbol( `toDisplayString` );
const MERGE_PROPS = Symbol( `mergeProps` );
const TO_HANDLERS = Symbol( `toHandlers` );
const CAMELIZE = Symbol( `camelize` );
const CAPITALIZE = Symbol( `capitalize` );
const SET_BLOCK_TRACKING = Symbol( `setBlockTracking` );
const PUSH_SCOPE_ID = Symbol( `pushScopeId` );
const POP_SCOPE_ID = Symbol( `popScopeId` );
const WITH_SCOPE_ID = Symbol( `withScopeId` );
const WITH_CTX = Symbol( `withCtx` );

const helperNameMap = {
    [FRAGMENT]: `Fragment`,
    [TELEPORT]: `Teleport`,
    [SUSPENSE]: `Suspense`,
    [KEEP_ALIVE]: `KeepAlive`,
    [BASE_TRANSITION]: `BaseTransition`,
    [OPEN_BLOCK]: `openBlock`,
    [CREATE_BLOCK]: `createBlock`,
    [CREATE_VNODE]: `_createVNode`,
    [CREATE_COMMENT]: `createCommentVNode`,
    [CREATE_TEXT]: `createTextVNode`,
    [CREATE_STATIC]: `createStaticVNode`,
    [RESOLVE_COMPONENT]: `resolveComponent`,
    [RESOLVE_DYNAMIC_COMPONENT]: `resolveDynamicComponent`,
    [RESOLVE_DIRECTIVE]: `resolveDirective`,
    [WITH_DIRECTIVES]: `withDirectives`,
    [RENDER_LIST]: `renderList`,
    [RENDER_SLOT]: `renderSlot`,
    [CREATE_SLOTS]: `createSlots`,
    [TO_DISPLAY_STRING]: `toDisplayString`,
    [MERGE_PROPS]: `mergeProps`,
    [TO_HANDLERS]: `toHandlers`,
    [CAMELIZE]: `camelize`,
    [CAPITALIZE]: `capitalize`,
    [SET_BLOCK_TRACKING]: `setBlockTracking`,
    [PUSH_SCOPE_ID]: `pushScopeId`,
    [POP_SCOPE_ID]: `popScopeId`,
    [WITH_SCOPE_ID]: `withScopeId`,
    [WITH_CTX]: `withCtx`
};

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
/*
* vnode shapeFlag: 
* 基本部分：0;1 ELEMENT; 2 FUNCTIONAL_COMPONENT; 4 STATEFUL_COMPONENT; 64 TELEPORT; 128 SUSPENSE
* 附加部分：0; 8 parent not TELEPORT,children is string; 16 children is array or string and parent not teleport; 32 SLOTS_CHILDREN (chidlren is object && paren not (ELEMENT|TELEPORT)), children is function
*
*/
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

function baseCompile(template, options = {}) {
    const onError = options.onError || defaultOnError;
    const isModuleMode = options.mode === 'module';
    /* istanbul ignore if */
    {
        if (options.prefixIdentifiers === true) {
            onError(createCompilerError(45 /* X_PREFIX_ID_NOT_SUPPORTED */));
        }
        else if (isModuleMode) {
            onError(createCompilerError(46 /* X_MODULE_MODE_NOT_SUPPORTED */));
        }
    }
    const prefixIdentifiers = !true ;
    if ( options.cacheHandlers) {
        onError(createCompilerError(47 /* X_CACHE_HANDLER_NOT_SUPPORTED */));
    }
    if (options.scopeId && !isModuleMode) {
        onError(createCompilerError(48 /* X_SCOPE_ID_NOT_SUPPORTED */));
    }
    const ast = isString(template) ? baseParse(template, options) : template;
    const [nodeTransforms, directiveTransforms] = getBaseTransformPreset();
    transform(ast, extend({}, options, {
        prefixIdentifiers,
        nodeTransforms: [
            ...nodeTransforms,
            ...(options.nodeTransforms || []) // user transforms
        ],
        directiveTransforms: extend({}, directiveTransforms, options.directiveTransforms || {} // user transforms
        )
    }));
    return generate(ast, extend({}, options, {
        prefixIdentifiers
    }));
}

function generate(ast, options = {}) {
    const context = createCodegenContext(ast, options);
    if (options.onContextCreated)
        options.onContextCreated(context);
    // 默认：mode = 'function'
    // prefixIdentifiers = mode === 'module'
    const { mode, push, prefixIdentifiers, indent, deindent, newline, scopeId, ssr } = context;
    const hasHelpers = ast.helpers.length > 0;
    const useWithBlock = !prefixIdentifiers && mode !== 'module';
    // preambles
    {
        genFunctionPreamble(ast, context);
    }
    // binding optimizations
    const optimizeSources = options.bindingMetadata
        ? `, $props, $setup, $data, $options`
        : ``;
    // enter render function

    // 1. 普通
    // function render(_ctx, _cache, $props, $setup, $data, $options){。。。}
    if (!ssr) {
        push(`function render(_ctx, _cache${optimizeSources}) {`);
    }
    // 2. ssr
    // function ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options){。。。}
    else {
        push(`function ssrRender(_ctx, _push, _parent, _attrs${optimizeSources}) {`);
    }
    indent();
    // 默认：mode = 'function'
    if (useWithBlock) {
        push(`with (_ctx) {`);
        indent();
        // function mode const declarations should be inside with block
        // also they should be renamed to avoid collision with user properties
        if (hasHelpers) {
            push(`const { ${ast.helpers
                .map(s => `${helperNameMap[s]}: _${helperNameMap[s]}`)
                .join(', ')} } = _Vue`);
            push(`\n`);
            newline();
        }
    }
    // generate asset resolution statements
    if (ast.components.length) {
        genAssets(ast.components, 'component', context);
        if (ast.directives.length || ast.temps > 0) {
            newline();
        }
    }
    if (ast.directives.length) {
        genAssets(ast.directives, 'directive', context);
        if (ast.temps > 0) {
            newline();
        }
    }
    if (ast.temps > 0) {
        push(`let `);
        for (let i = 0; i < ast.temps; i++) {
            push(`${i > 0 ? `, ` : ``}_temp${i}`);
        }
    }
    if (ast.components.length || ast.directives.length || ast.temps) {
        push(`\n`);
        newline();
    }
    // generate the VNode tree expression
    if (!ssr) {
        push(`return `);
    }
    if (ast.codegenNode) {
        genNode(ast.codegenNode, context);
    }
    else {
        push(`null`);
    }
    if (useWithBlock) {
        deindent();
        push(`}`);
    }
    deindent();
    push(`}`);
    return {
        ast,
        code: context.code,
        // SourceMapGenerator does have toJSON() method but it's not in the types
        map: context.map ? context.map.toJSON() : undefined
    };
}

    const PURE_ANNOTATION = `/*#__PURE__*/`;
    function createCodegenContext(ast, { 
        mode = 'function', 
        prefixIdentifiers = mode === 'module', 
        sourceMap = false, 
        filename = `template.vue.html`, 
        scopeId = null, 
        optimizeImports = false, 
        runtimeGlobalName = `Vue`, 
        runtimeModuleName = `vue`, 
        ssr = false 
    }) {
        const context = {
            mode,
            prefixIdentifiers,
            sourceMap,
            filename,
            scopeId,
            optimizeImports,
            runtimeGlobalName,
            runtimeModuleName,
            ssr,
            source: ast.loc.source,
            code: ``,
            column: 1,
            line: 1,
            offset: 0,
            indentLevel: 0,
            pure: false,
            map: undefined,
            helper(key) {
                return `_${helperNameMap[key]}`;
            },
            push(code, node) {
                context.code += code;
            },
            indent() {
                newline(++context.indentLevel);
            },
            deindent(withoutNewLine = false) {
                if (withoutNewLine) {
                    --context.indentLevel;
                }
                else {
                    newline(--context.indentLevel);
                }
            },
            newline() {
                newline(context.indentLevel);
            }
        };
        function newline(n) {
            context.push('\n' + `  `.repeat(n));
        }
        return context;
    }

    function genFunctionPreamble(ast, context) {
        const { ssr, prefixIdentifiers, push, newline, runtimeModuleName, runtimeGlobalName } = context;
        const VueBinding =  runtimeGlobalName;
        const aliasHelper = (s) => `${helperNameMap[s]}: _${helperNameMap[s]}`;
        // Generate const declaration for helpers
        // In prefix mode, we place the const declaration at top so it's done
        // only once; But if we not prefixing, we place the declaration inside the
        // with block so it doesn't incur the `in` check cost for every helper access.
        if (ast.helpers.length > 0) {
            {
                // "with" mode.
                // save Vue in a separate variable to avoid collision
                push(`const _Vue = ${VueBinding}\n`);
                // in "with" mode, helpers are declared inside the with block to avoid
                // has check cost, but hoists are lifted out of the function - we need
                // to provide the helper here.
                if (ast.hoists.length) {
                    const staticHelpers = [
                        CREATE_VNODE,
                        CREATE_COMMENT,
                        CREATE_TEXT,
                        CREATE_STATIC
                    ]
                        .filter(helper => ast.helpers.includes(helper))
                        .map(aliasHelper)
                        .join(', ');
                    push(`const { ${staticHelpers} } = _Vue\n`);
                }
            }
        }
        genHoists(ast.hoists, context);
        newline();
        push(`return `);
    }

    function genAssets(assets, type, { helper, push, newline }) {
        const resolver = helper(type === 'component' ? RESOLVE_COMPONENT : RESOLVE_DIRECTIVE);
        for (let i = 0; i < assets.length; i++) {
            const id = assets[i];
            push(`const ${toValidAssetId(id, type)} = ${resolver}(${JSON.stringify(id)})`);
            if (i < assets.length - 1) {
                newline();
            }
        }
    }


    function genNode(node, context) {
        if (isString(node)) {
            context.push(node);
            return;
        }
        if (isSymbol(node)) {
            context.push(context.helper(node));
            return;
        }
        switch (node.type) {
            case 1 /* ELEMENT */:
            case 9 /* IF */:
            case 11 /* FOR */:
                
                    assert(node.codegenNode != null, `Codegen node is missing for element/if/for node. ` +
                        `Apply appropriate transforms first.`);
                genNode(node.codegenNode, context);
                break;
            case 2 /* TEXT */:
                genText(node, context);
                break;
            case 4 /* SIMPLE_EXPRESSION */:
                genExpression(node, context);
                break;
            case 5 /* INTERPOLATION */:
                genInterpolation(node, context);
                break;
            case 12 /* TEXT_CALL */:
                genNode(node.codegenNode, context);
                break;
            case 8 /* COMPOUND_EXPRESSION */:
                genCompoundExpression(node, context);
                break;
            case 3 /* COMMENT */:
                genComment(node, context);
                break;
            /**
             * 
             * 1.root, children > 1; 
             * 2. children.length !== 1 || firstChild.type !== 1  ELEMENT  && （children.length ！== 1 || firstChild.type ！== 11 fornode ）
             * 3.fornode
             * 4.postTransformElement
             */
            case 13 /* VNODE_CALL */:
                genVNodeCall(node, context);
                break;
            case 14 /* JS_CALL_EXPRESSION */:
                genCallExpression(node, context);
                break;
            case 15 /* JS_OBJECT_EXPRESSION */:
                genObjectExpression(node, context);
                break;
            case 17 /* JS_ARRAY_EXPRESSION */:
                genArrayExpression(node, context);
                break;
            case 18 /* JS_FUNCTION_EXPRESSION */:
                genFunctionExpression(node, context);
                break;
            case 19 /* JS_CONDITIONAL_EXPRESSION */:
                genConditionalExpression(node, context);
                break;
            case 20 /* JS_CACHE_EXPRESSION */:
                genCacheExpression(node, context);
                break;
            // SSR only types
            case 21 /* JS_BLOCK_STATEMENT */:
                break;
            case 22 /* JS_TEMPLATE_LITERAL */:
                break;
            case 23 /* JS_IF_STATEMENT */:
                break;
            case 24 /* JS_ASSIGNMENT_EXPRESSION */:
                break;
            case 25 /* JS_SEQUENCE_EXPRESSION */:
                break;
            case 26 /* JS_RETURN_STATEMENT */:
                break;
            /* istanbul ignore next */
            case 10 /* IF_BRANCH */:
                // noop
                break;
            default:
                {
                    assert(false, `unhandled codegen node type: ${node.type}`);
                    // make sure we exhaust all possible types
                    const exhaustiveCheck = node;
                    return exhaustiveCheck;
                }
        }
    }

            function genText(node, context) {
                context.push(JSON.stringify(node.content), node);
            }
            function genExpression(node, context) {
                const { content, isStatic } = node;
                context.push(isStatic ? JSON.stringify(content) : content, node);
            }
            function genInterpolation(node, context) {
                const { push, helper, pure } = context;
                if (pure)
                    push(PURE_ANNOTATION);
                push(`${helper(TO_DISPLAY_STRING)}(`);
                genNode(node.content, context);
                push(`)`);
            }
            function genCompoundExpression(node, context) {
                for (let i = 0; i < node.children.length; i++) {
                    const child = node.children[i];
                    if (isString(child)) {
                        context.push(child);
                    }
                    else {
                        genNode(child, context);
                    }
                }
            }
            function genExpressionAsPropertyKey(node, context) {
                const { push } = context;
                if (node.type === 8 /* COMPOUND_EXPRESSION */) {
                    push(`[`);
                    genCompoundExpression(node, context);
                    push(`]`);
                }
                else if (node.isStatic) {
                    // only quote keys if necessary
                    const text = isSimpleIdentifier(node.content)
                        ? node.content
                        : JSON.stringify(node.content);
                    push(text, node);
                }
                else {
                    push(`[${node.content}]`, node);
                }
            }
            function genComment(node, context) {
                {
                    const { push, helper, pure } = context;
                    if (pure) {
                        push(PURE_ANNOTATION);
                    }
                    push(`${helper(CREATE_COMMENT)}(${JSON.stringify(node.content)})`, node);
                }
            }
            function genVNodeCall(node, context) {
                const { push, helper, pure } = context;
                const { tag, props, children, patchFlag, dynamicProps, directives, isBlock, disableTracking } = node;
                if (directives) {
                    push(helper(WITH_DIRECTIVES) + `(`);
                }
                if (isBlock) {
                    push(`(${helper(OPEN_BLOCK)}(${disableTracking ? `true` : ``}), `);
                }
                if (pure) {
                    push(PURE_ANNOTATION);
                }
                push(helper(isBlock ? CREATE_BLOCK : CREATE_VNODE) + `(`, node);
                genNodeList(genNullableArgs([tag, props, children, patchFlag, dynamicProps]), context);
                push(`)`);
                if (isBlock) {
                    push(`)`);
                }
                if (directives) {
                    push(`, `);
                    genNode(directives, context);
                    push(`)`);
                }
            }
                    /**
                     * Adds directives to a VNode.
                     */
                    function withDirectives(vnode, directives) {
                        const internalInstance = currentRenderingInstance;
                        if (internalInstance === null) {
                            warn(`withDirectives can only be used inside render functions.`);
                            return vnode;
                        }
                        const instance = internalInstance.proxy;
                        const bindings = vnode.dirs || (vnode.dirs = []);
                        for (let i = 0; i < directives.length; i++) {
                            let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i];
                            if (isFunction(dir)) {
                                dir = {
                                    mounted: dir,
                                    updated: dir
                                };
                            }
                            bindings.push({
                                dir,
                                instance,
                                value,
                                oldValue: void 0,
                                arg,
                                modifiers
                            });
                        }
                        return vnode;
                    }

                    /**
                     * Create a block root vnode. Takes the same exact arguments as `createVNode`.
                     * A block root keeps track of dynamic nodes within the block in the
                     * `dynamicChildren` array.
                     *
                     * @private
                     */
                    function createBlock(type, props, children, patchFlag, dynamicProps) {
                        const vnode = createVNode(type, props, children, patchFlag, dynamicProps, true /* isBlock: prevent a block from tracking itself */);
                        // save current block children on the block vnode
                        vnode.dynamicChildren = currentBlock || EMPTY_ARR;
                        // close block
                        closeBlock();
                        // a block is always going to be patched, so track it as a child of its
                        // parent block
                        if (shouldTrack$1 > 0 && currentBlock) {
                            currentBlock.push(vnode);
                        }
                        return vnode;
                    }

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

                        function normalizeChildren(vnode, children) {
                            let type = 0;
                            const { shapeFlag } = vnode;
                            if (children == null) {
                                children = null;
                            }
                            else if (isArray(children)) {
                                type = 16 /* ARRAY_CHILDREN */;
                            }
                            else if (typeof children === 'object') {
                                if (shapeFlag & 1 /* ELEMENT */ || shapeFlag & 64 /* TELEPORT */) {
                                    // Normalize slot to plain children for plain element and Teleport
                                    const slot = children.default;
                                    if (slot) {
                                        // _c marker is added by withCtx() indicating this is a compiled slot
                                        slot._c && setCompiledSlotRendering(1);
                                        normalizeChildren(vnode, slot());
                                        slot._c && setCompiledSlotRendering(-1);
                                    }
                                    return;
                                }
                                else {
                                    type = 32 /* SLOTS_CHILDREN */;
                                    const slotFlag = children._;
                                    if (!slotFlag && !(InternalObjectKey in children)) {
                                        children._ctx = currentRenderingInstance;
                                    }
                                    else if (slotFlag === 3 /* FORWARDED */ && currentRenderingInstance) {
                                        // a child component receives forwarded slots from the parent.
                                        // its slot type is determined by its parent's slot type.
                                        if (currentRenderingInstance.vnode.patchFlag & 1024 /* DYNAMIC_SLOTS */) {
                                            children._ = 2 /* DYNAMIC */;
                                            vnode.patchFlag |= 1024 /* DYNAMIC_SLOTS */;
                                        }
                                        else {
                                            children._ = 1 /* STABLE */;
                                        }
                                    }
                                }
                            }
                            else if (isFunction(children)) {
                                children = { default: children, _ctx: currentRenderingInstance };
                                type = 32 /* SLOTS_CHILDREN */;
                            }
                            else {
                                children = String(children);
                                // force teleport children to array so it can be moved around
                                if (shapeFlag & 64 /* TELEPORT */) {
                                    type = 16 /* ARRAY_CHILDREN */;
                                    children = [createTextVNode(children)];
                                }
                                else {
                                    type = 8 /* TEXT_CHILDREN */;
                                }
                            }
                            vnode.children = children;
                            vnode.shapeFlag |= type;
                        }

                        function normalizeSuspenseChildren(vnode) {
                            const { shapeFlag, children } = vnode;
                            let content;
                            let fallback;
                            if (shapeFlag & 32 /* SLOTS_CHILDREN */) {
                                content = normalizeSuspenseSlot(children.default);
                                fallback = normalizeSuspenseSlot(children.fallback);
                            }
                            else {
                                content = normalizeSuspenseSlot(children);
                                fallback = normalizeVNode(null);
                            }
                            return {
                                content,
                                fallback
                            };
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
                            function normalizeSuspenseSlot(s) {
                                if (isFunction(s)) {
                                    s = s();
                                }
                                if (isArray(s)) {
                                    const singleChild = filterSingleRoot(s);
                                    if ( !singleChild) {
                                        warn(`<Suspense> slots expect a single root node.`);
                                    }
                                    s = singleChild;
                                }
                                return normalizeVNode(s);
                            }
                           function filterSingleRoot(children) {
                               const filtered = children.filter(child => {
                                   return !(isVNode(child) &&
                                       child.type === Comment &&
                                       child.children !== 'v-if');
                               });
                               return filtered.length === 1 && isVNode(filtered[0]) ? filtered[0] : null;
                           }

            function genNodeList(nodes, context, multilines = false, comma = true) {
                const { push, newline } = context;
                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    if (isString(node)) {
                        push(node);
                    }
                    else if (isArray(node)) {
                        genNodeListAsArray(node, context);
                    }
                    else {
                        genNode(node, context);
                    }
                    if (i < nodes.length - 1) {
                        if (multilines) {
                            comma && push(',');
                            newline();
                        }
                        else {
                            comma && push(', ');
                        }
                    }
                }
            }
            function genNullableArgs(args) {
                let i = args.length;
                while (i--) {
                    if (args[i] != null)
                        break;
                }
                return args.slice(0, i + 1).map(arg => arg || `null`);
            }
            // JavaScript
            function genCallExpression(node, context) {
                const { push, helper, pure } = context;
                const callee = isString(node.callee) ? node.callee : helper(node.callee);
                if (pure) {
                    push(PURE_ANNOTATION);
                }
                push(callee + `(`, node);
                genNodeList(node.arguments, context);
                push(`)`);
            }
            function genObjectExpression(node, context) {
                const { push, indent, deindent, newline } = context;
                const { properties } = node;
                if (!properties.length) {
                    push(`{}`, node);
                    return;
                }
                const multilines = properties.length > 1 ||
                    (
                        properties.some(p => p.value.type !== 4 /* SIMPLE_EXPRESSION */));
                push(multilines ? `{` : `{ `);
                multilines && indent();
                for (let i = 0; i < properties.length; i++) {
                    const { key, value } = properties[i];
                    // key
                    genExpressionAsPropertyKey(key, context);
                    push(`: `);
                    // value
                    genNode(value, context);
                    if (i < properties.length - 1) {
                        // will only reach this if it's multilines
                        push(`,`);
                        newline();
                    }
                }
                multilines && deindent();
                push(multilines ? `}` : ` }`);
            }
            function genArrayExpression(node, context) {
                genNodeListAsArray(node.elements, context);
            }
                function genNodeListAsArray(nodes, context) {
                    const multilines = nodes.length > 3 ||
                        ( nodes.some(n => isArray(n) || !isText$1(n)));
                    context.push(`[`);
                    multilines && context.indent();
                    genNodeList(nodes, context, multilines);
                    multilines && context.deindent();
                    context.push(`]`);
                }
            function genFunctionExpression(node, context) {
                const { push, indent, deindent, scopeId, mode } = context;
                const { params, returns, body, newline, isSlot } = node;
                if (isSlot) {
                    push(`_${helperNameMap[WITH_CTX]}(`);
                }
                push(`(`, node);
                if (isArray(params)) {
                    genNodeList(params, context);
                }
                else if (params) {
                    genNode(params, context);
                }
                push(`) => `);
                if (newline || body) {
                    push(`{`);
                    indent();
                }
                if (returns) {
                    if (newline) {
                        push(`return `);
                    }
                    if (isArray(returns)) {
                        genNodeListAsArray(returns, context);
                    }
                    else {
                        genNode(returns, context);
                    }
                }
                else if (body) {
                    genNode(body, context);
                }
                if (newline || body) {
                    deindent();
                    push(`}`);
                }
                if ( isSlot) {
                    push(`)`);
                }
            }
            function genConditionalExpression(node, context) {
                const { test, consequent, alternate, newline: needNewline } = node;
                const { push, indent, deindent, newline } = context;
                if (test.type === 4 /* SIMPLE_EXPRESSION */) {
                    const needsParens = !isSimpleIdentifier(test.content);
                    needsParens && push(`(`);
                    genExpression(test, context);
                    needsParens && push(`)`);
                }
                else {
                    push(`(`);
                    genNode(test, context);
                    push(`)`);
                }
                needNewline && indent();
                context.indentLevel++;
                needNewline || push(` `);
                push(`? `);
                genNode(consequent, context);
                context.indentLevel--;
                needNewline && newline();
                needNewline || push(` `);
                push(`: `);
                const isNested = alternate.type === 19 /* JS_CONDITIONAL_EXPRESSION */;
                if (!isNested) {
                    context.indentLevel++;
                }
                genNode(alternate, context);
                if (!isNested) {
                    context.indentLevel--;
                }
                needNewline && deindent(true /* without newline */);
            }
            function genCacheExpression(node, context) {
                const { push, helper, indent, deindent, newline } = context;
                push(`_cache[${node.index}] || (`);
                if (node.isVNode) {
                    indent();
                    push(`${helper(SET_BLOCK_TRACKING)}(-1),`);
                    newline();
                }
                push(`_cache[${node.index}] = `);
                genNode(node.value, context);
                if (node.isVNode) {
                    push(`,`);
                    newline();
                    push(`${helper(SET_BLOCK_TRACKING)}(1),`);
                    newline();
                    push(`_cache[${node.index}]`);
                    deindent();
                }
                push(`)`);
            }
/**
 * block tracking 机制
 */

// Since v-if and v-for are the two possible ways node structure can dynamically
// change, once we consider v-if branches and each v-for fragment a block, we
// can divide a template into nested blocks, and within each block the node
// structure would be stable. This allows us to skip most children diffing
// and only worry about the dynamic nodes (indicated by patch flags).
const blockStack = [];
let currentBlock = null;
/**
 * Open a block.
 * This must be called before `createBlock`. It cannot be part of `createBlock`
 * because the children of the block are evaluated before `createBlock` itself
 * is called. The generated code typically looks like this:
 *
 * ```js
 * function render() {
 *   return (openBlock(),createBlock('div', null, [...]))
 * }
 * ```
 * disableTracking is true when creating a v-for fragment block, since a v-for
 * fragment always diffs its children.
 *
 * @private
 */
function openBlock(disableTracking = false) {
    blockStack.push((currentBlock = disableTracking ? null : []));
}
function closeBlock() {
    blockStack.pop();
    currentBlock = blockStack[blockStack.length - 1] || null;
}

/**
 * Create a block root vnode. Takes the same exact arguments as `createVNode`.
 * A block root keeps track of dynamic nodes within the block in the
 * `dynamicChildren` array.
 *
 * @private
 */
// createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false)
function createBlock(type, props, children, patchFlag, dynamicProps) {
    const vnode = createVNode(type, props, children, patchFlag, dynamicProps, true /* isBlock: prevent a block from tracking itself */);
    // save current block children on the block vnode
    vnode.dynamicChildren = currentBlock || EMPTY_ARR;
    // close block
    closeBlock();
    // a block is always going to be patched, so track it as a child of its
    // parent block
    if (shouldTrack$1 > 0 && currentBlock) {
        currentBlock.push(vnode);
    }
    return vnode;
}


// Whether we should be tracking dynamic child nodes inside a block.
// Only tracks when this value is > 0
// We are not using a simple boolean because this value may need to be
// incremented/decremented by nested usage of v-once (see below)
let shouldTrack$1 = 1;
/**
 * Block tracking sometimes needs to be disabled, for example during the
 * creation of a tree that needs to be cached by v-once. The compiler generates
 * code like this:
 *
 * ``` js
 * _cache[1] || (
 *   setBlockTracking(-1),
 *   _cache[1] = createVNode(...),
 *   setBlockTracking(1),
 *   _cache[1]
 * )
 * ```
 *
 * @private
 */
function setBlockTracking(value) {
    shouldTrack$1 += value;
}


var runtimeDom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    render: render,
    hydrate: hydrate,
    createApp: createApp,
    createSSRApp: createSSRApp,
    useCssModule: useCssModule,
    useCssVars: useCssVars,
    Transition: Transition,
    TransitionGroup: TransitionGroup,
    vModelText: vModelText,
    vModelCheckbox: vModelCheckbox,
    vModelRadio: vModelRadio,
    vModelSelect: vModelSelect,
    vModelDynamic: vModelDynamic,
    withModifiers: withModifiers,
    withKeys: withKeys,
    vShow: vShow,
    reactive: reactive,
    ref: ref,
    readonly: readonly,
    unref: unref,
    proxyRefs: proxyRefs,
    isRef: isRef,
    toRef: toRef,
    toRefs: toRefs,
    isProxy: isProxy,
    isReactive: isReactive,
    isReadonly: isReadonly,
    customRef: customRef,
    triggerRef: triggerRef,
    shallowRef: shallowRef,
    shallowReactive: shallowReactive,
    shallowReadonly: shallowReadonly,
    markRaw: markRaw,
    toRaw: toRaw,
    computed: computed$1,
    watch: watch,
    watchEffect: watchEffect,
    onBeforeMount: onBeforeMount,
    onMounted: onMounted,
    onBeforeUpdate: onBeforeUpdate,
    onUpdated: onUpdated,
    onBeforeUnmount: onBeforeUnmount,
    onUnmounted: onUnmounted,
    onActivated: onActivated,
    onDeactivated: onDeactivated,
    onRenderTracked: onRenderTracked,
    onRenderTriggered: onRenderTriggered,
    onErrorCaptured: onErrorCaptured,
    provide: provide,
    inject: inject,
    nextTick: nextTick,
    defineComponent: defineComponent,
    defineAsyncComponent: defineAsyncComponent,
    getCurrentInstance: getCurrentInstance,
    h: h,
    createVNode: createVNode,
    cloneVNode: cloneVNode,
    mergeProps: mergeProps,
    isVNode: isVNode,
    Fragment: Fragment,
    Text: Text,
    Comment: Comment,
    Static: Static,
    Teleport: Teleport,
    Suspense: Suspense,
    KeepAlive: KeepAlive,
    BaseTransition: BaseTransition,
    withDirectives: withDirectives,
    useSSRContext: useSSRContext,
    ssrContextKey: ssrContextKey,
    createRenderer: createRenderer,
    createHydrationRenderer: createHydrationRenderer,
    queuePostFlushCb: queuePostFlushCb,
    warn: warn,
    handleError: handleError,
    callWithErrorHandling: callWithErrorHandling,
    callWithAsyncErrorHandling: callWithAsyncErrorHandling,
    resolveComponent: resolveComponent,
    resolveDirective: resolveDirective,
    resolveDynamicComponent: resolveDynamicComponent,
    registerRuntimeCompiler: registerRuntimeCompiler,
    useTransitionState: useTransitionState,
    resolveTransitionHooks: resolveTransitionHooks,
    setTransitionHooks: setTransitionHooks,
    getTransitionRawChildren: getTransitionRawChildren,
    get devtools () { return devtools; },
    setDevtoolsHook: setDevtoolsHook,
    withCtx: withCtx,
    renderList: renderList,
    toHandlers: toHandlers,
    renderSlot: renderSlot,
    createSlots: createSlots,
    pushScopeId: pushScopeId,
    popScopeId: popScopeId,
    withScopeId: withScopeId,
    openBlock: openBlock,
    createBlock: createBlock,
    setBlockTracking: setBlockTracking,
    createTextVNode: createTextVNode,
    createCommentVNode: createCommentVNode,
    createStaticVNode: createStaticVNode,
    toDisplayString: toDisplayString,
    camelize: camelize,
    capitalize: capitalize,
    transformVNodeArgs: transformVNodeArgs,
    version: version,
    ssrUtils: ssrUtils
  });
function compileToFunction(template, options) {
    if (!isString(template)) {
        if (template.nodeType) {
            template = template.innerHTML;
        }
        else {
             warn(`invalid template option: `, template);
            return NOOP;
        }
    }
    const key = template;
    const cached = compileCache[key];
    if (cached) {
        return cached;
    }
    if (template[0] === '#') {
        const el = document.querySelector(template);
        if ( !el) {
            warn(`Template element not found or is empty: ${template}`);
        }
        // __UNSAFE__
        // Reason: potential execution of JS expressions in in-DOM template.
        // The user must make sure the in-DOM template is trusted. If it's rendered
        // by the server, the template should not contain any user data.
        template = el ? el.innerHTML : ``;
    }
    const { code } = compile$1(template, extend({
        hoistStatic: true,
        onError(err) {
            {
                const message = `Template compilation error: ${err.message}`;
                const codeFrame = err.loc &&
                    generateCodeFrame(template, err.loc.start.offset, err.loc.end.offset);
                warn(codeFrame ? `${message}\n${codeFrame}` : message);
            }
        }
    }, options));
    // The wildcard import results in a huge object with every export
    // with keys that cannot be mangled, and can be quite heavy size-wise.
    // In the global build we know `Vue` is available globally so we can avoid
    // the wildcard object.
    const render = ( new Function('Vue', code)(runtimeDom));
    render._rc = true;
    return (compileCache[key] = render);
}