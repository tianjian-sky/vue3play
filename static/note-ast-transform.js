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

function getBaseTransformPreset(prefixIdentifiers) {
    return [
        [
            transformOnce,
            transformIf,
            transformFor,
            ...(  [transformExpression]
                    ),
            transformSlotOutlet,
            transformElement,
            trackSlotScopes,
            transformText
        ],
        {
            on: transformOn,
            bind: transformBind,
            model: transformModel
        }
    ];
}
        function replaceNode(node) {
            /* istanbul ignore if */
            {
                if (!context.currentNode) {
                    throw new Error(`Node being replaced is already removed.`);
                }
                if (!context.parent) {
                    throw new Error(`Cannot replace root node.`);
                }
            }
            context.parent.children[context.childIndex] = context.currentNode = node;
        }


        // 2.1 nodeTransforms
        const transformOnce = (node, context) => {
            if (node.type === 1 /* ELEMENT */ && findDir(node, 'once', true)) {
                if (seen.has(node)) {
                    return;
                }
                seen.add(node);
                context.helper(SET_BLOCK_TRACKING);
                return () => {
                    const cur = context.currentNode;
                    if (cur.codegenNode) {
                        cur.codegenNode = context.cache(cur.codegenNode, true /* isVNode */);
                    }
                };
            }
        };
        const transformIf = createStructuralDirectiveTransform(/^(if|else|else-if)$/, (node, dir, context) => {
            return processIf(node, dir, context, (ifNode, branch, isRoot) => {
                // #1587: We need to dynamically increment the key based on the current
                // node's sibling nodes, since chained v-if/else branches are
                // rendered at the same depth
                const siblings = context.parent.children;
                let i = siblings.indexOf(ifNode);
                let key = 0;
                while (i-- >= 0) {
                    const sibling = siblings[i];
                    if (sibling && sibling.type === 9 /* IF */) {
                        key += sibling.branches.length;
                    }
                }
                // Exit callback. Complete the codegenNode when all children have been
                // transformed.
                return () => {
                    if (isRoot) {
                        ifNode.codegenNode = createCodegenNodeForBranch(branch, key, context);
                    }
                    else {
                        // attach this branch's codegen node to the v-if root.
                        let parentCondition = ifNode.codegenNode;
                        while (parentCondition.alternate.type ===
                            19 /* JS_CONDITIONAL_EXPRESSION */) {
                            parentCondition = parentCondition.alternate;
                        }
                        parentCondition.alternate = createCodegenNodeForBranch(branch, key + ifNode.branches.length - 1, context);
                    }
                };
            });
        });
                function createStructuralDirectiveTransform(name, fn) {
                    const matches = isString(name)
                        ? (n) => n === name
                        : (n) => name.test(n);
                    return (node, context) => {
                        if (node.type === 1 /* ELEMENT */) {
                            const { props } = node;
                            // structural directive transforms are not concerned with slots
                            // as they are handled separately in vSlot.ts
                            if (node.tagType === 3 /* TEMPLATE */ && props.some(isVSlot)) {
                                return;
                            }
                            const exitFns = [];
                            for (let i = 0; i < props.length; i++) {
                                const prop = props[i];
                                if (prop.type === 7 /* DIRECTIVE */ && matches(prop.name)) {
                                    // structural directives are removed to avoid infinite recursion
                                    // also we remove them *before* applying so that it can further
                                    // traverse itself in case it moves the node around
                                    props.splice(i, 1);
                                    i--;
                                    const onExit = fn(node, prop, context);
                                    if (onExit)
                                        exitFns.push(onExit);
                                }
                            }
                            return exitFns;
                        }
                    };
                }
        
        const transformFor = createStructuralDirectiveTransform('for', (node, dir, context) => {
            const { helper } = context;
            return processFor(node, dir, context, forNode => {
                // create the loop render function expression now, and add the
                // iterator on exit after all children have been traversed
                const renderExp = createCallExpression(helper(RENDER_LIST), [
                    forNode.source
                ]);
                const keyProp = findProp(node, `key`);
                const keyProperty = keyProp
                    ? createObjectProperty(`key`, keyProp.type === 6 /* ATTRIBUTE */
                        ? createSimpleExpression(keyProp.value.content, true)
                        : keyProp.exp)
                    : null;
                const isStableFragment = forNode.source.type === 4 /* SIMPLE_EXPRESSION */ &&
                    forNode.source.isConstant;
                const fragmentFlag = isStableFragment
                    ? 64 /* STABLE_FRAGMENT */
                    : keyProp
                        ? 128 /* KEYED_FRAGMENT */
                        : 256 /* UNKEYED_FRAGMENT */;
                forNode.codegenNode = createVNodeCall(context, helper(FRAGMENT), undefined, renderExp, `${fragmentFlag} /* ${PatchFlagNames[fragmentFlag]} */`, undefined, undefined, true /* isBlock */, !isStableFragment /* disableTracking */, node.loc);
                return () => {
                    // finish the codegen now that all children have been traversed
                    let childBlock;
                    const isTemplate = isTemplateNode(node);
                    const { children } = forNode;
                    // check <template v-for> key placement
                    if ( isTemplate) {
                        node.children.some(c => {
                            if (c.type === 1 /* ELEMENT */) {
                                const key = findProp(c, 'key');
                                if (key) {
                                    context.onError(createCompilerError(32 /* X_V_FOR_TEMPLATE_KEY_PLACEMENT */, key.loc));
                                    return true;
                                }
                            }
                        });
                    }
                    const needFragmentWrapper = children.length !== 1 || children[0].type !== 1 /* ELEMENT */;
                    const slotOutlet = isSlotOutlet(node)
                        ? node
                        : isTemplate &&
                            node.children.length === 1 &&
                            isSlotOutlet(node.children[0])
                            ? node.children[0] // api-extractor somehow fails to infer this
                            : null;
                    if (slotOutlet) {
                        // <slot v-for="..."> or <template v-for="..."><slot/></template>
                        childBlock = slotOutlet.codegenNode;
                        if (isTemplate && keyProperty) {
                            // <template v-for="..." :key="..."><slot/></template>
                            // we need to inject the key to the renderSlot() call.
                            // the props for renderSlot is passed as the 3rd argument.
                            injectProp(childBlock, keyProperty, context);
                        }
                    }
                    else if (needFragmentWrapper) {
                        // <template v-for="..."> with text or multi-elements
                        // should generate a fragment block for each loop
                        childBlock = createVNodeCall(context, helper(FRAGMENT), keyProperty ? createObjectExpression([keyProperty]) : undefined, node.children, `${64 /* STABLE_FRAGMENT */} /* ${PatchFlagNames[64 /* STABLE_FRAGMENT */]} */`, undefined, undefined, true);
                    }
                    else {
                        // Normal element v-for. Directly use the child's codegenNode
                        // but mark it as a block.
                        childBlock = children[0]
                            .codegenNode;
                        if (isTemplate && keyProperty) {
                            injectProp(childBlock, keyProperty, context);
                        }
                        childBlock.isBlock = !isStableFragment;
                        if (childBlock.isBlock) {
                            helper(OPEN_BLOCK);
                            helper(CREATE_BLOCK);
                        }
                    }
                    renderExp.arguments.push(createFunctionExpression(createForLoopParams(forNode.parseResult), childBlock, true /* force newline */));
                };
            });
        });
        const transformExpression = (node, context) => {
            if (node.type === 5 /* INTERPOLATION */) {
                node.content = processExpression(node.content, context);
            }
            else if (node.type === 1 /* ELEMENT */) {
                // handle directives on element
                for (let i = 0; i < node.props.length; i++) {
                    const dir = node.props[i];
                    // do not process for v-on & v-for since they are special handled
                    if (dir.type === 7 /* DIRECTIVE */ && dir.name !== 'for') {
                        const exp = dir.exp;
                        const arg = dir.arg;
                        // do not process exp if this is v-on:arg - we need special handling
                        // for wrapping inline statements.
                        if (exp &&
                            exp.type === 4 /* SIMPLE_EXPRESSION */ &&
                            !(dir.name === 'on' && arg)) {
                            dir.exp = processExpression(exp, context, 
                            // slot args must be processed as function params
                            dir.name === 'slot');
                        }
                        if (arg && arg.type === 4 /* SIMPLE_EXPRESSION */ && !arg.isStatic) {
                            dir.arg = processExpression(arg, context);
                        }
                    }
                }
            }
        };
        const transformSlotOutlet = (node, context) => {
            if (isSlotOutlet(node)) {
                const { children, loc } = node;
                const { slotName, slotProps } = processSlotOutlet(node, context);
                const slotArgs = [
                    context.prefixIdentifiers ? `_ctx.$slots` : `$slots`,
                    slotName
                ];
                if (slotProps) {
                    slotArgs.push(slotProps);
                }
                if (children.length) {
                    if (!slotProps) {
                        slotArgs.push(`{}`);
                    }
                    slotArgs.push(createFunctionExpression([], children, false, false, loc));
                }
                node.codegenNode = createCallExpression(context.helper(RENDER_SLOT), slotArgs, loc);
            }
        };
        const transformElement = (node, context) => {
            if (!(node.type === 1 /* ELEMENT */ &&
                (node.tagType === 0 /* ELEMENT */ ||
                    node.tagType === 1 /* COMPONENT */))) {
                return;
            }
            // perform the work on exit, after all child expressions have been
            // processed and merged.
            return function postTransformElement() {
                const { tag, props } = node;
                const isComponent = node.tagType === 1 /* COMPONENT */;
                // The goal of the transform is to create a codegenNode implementing the
                // VNodeCall interface.
                const vnodeTag = isComponent
                    ? resolveComponentType(node, context)
                    : `"${tag}"`;
                const isDynamicComponent = isObject(vnodeTag) && vnodeTag.callee === RESOLVE_DYNAMIC_COMPONENT;
                let vnodeProps;
                let vnodeChildren;
                let vnodePatchFlag;
                let patchFlag = 0;
                let vnodeDynamicProps;
                let dynamicPropNames;
                let vnodeDirectives;
                let shouldUseBlock = 
                // dynamic component may resolve to plain elements
                isDynamicComponent ||
                    vnodeTag === TELEPORT ||
                    vnodeTag === SUSPENSE ||
                    (!isComponent &&
                        // <svg> and <foreignObject> must be forced into blocks so that block
                        // updates inside get proper isSVG flag at runtime. (#639, #643)
                        // This is technically web-specific, but splitting the logic out of core
                        // leads to too much unnecessary complexity.
                        (tag === 'svg' ||
                            tag === 'foreignObject' ||
                            // #938: elements with dynamic keys should be forced into blocks
                            findProp(node, 'key', true)));
                // props
                if (props.length > 0) {
                    const propsBuildResult = buildProps(node, context);
                    vnodeProps = propsBuildResult.props;
                    patchFlag = propsBuildResult.patchFlag;
                    dynamicPropNames = propsBuildResult.dynamicPropNames;
                    const directives = propsBuildResult.directives;
                    vnodeDirectives =
                        directives && directives.length
                            ? createArrayExpression(directives.map(dir => buildDirectiveArgs(dir, context)))
                            : undefined;
                }
                // children
                if (node.children.length > 0) {
                    if (vnodeTag === KEEP_ALIVE) {
                        // Although a built-in component, we compile KeepAlive with raw children
                        // instead of slot functions so that it can be used inside Transition
                        // or other Transition-wrapping HOCs.
                        // To ensure correct updates with block optimizations, we need to:
                        // 1. Force keep-alive into a block. This avoids its children being
                        //    collected by a parent block.
                        shouldUseBlock = true;
                        // 2. Force keep-alive to always be updated, since it uses raw children.
                        patchFlag |= 1024 /* DYNAMIC_SLOTS */;
                        if ( node.children.length > 1) {
                            context.onError(createCompilerError(44 /* X_KEEP_ALIVE_INVALID_CHILDREN */, {
                                start: node.children[0].loc.start,
                                end: node.children[node.children.length - 1].loc.end,
                                source: ''
                            }));
                        }
                    }
                    const shouldBuildAsSlots = isComponent &&
                        // Teleport is not a real component and has dedicated runtime handling
                        vnodeTag !== TELEPORT &&
                        // explained above.
                        vnodeTag !== KEEP_ALIVE;
                    if (shouldBuildAsSlots) {
                        const { slots, hasDynamicSlots } = buildSlots(node, context);
                        vnodeChildren = slots;
                        if (hasDynamicSlots) {
                            patchFlag |= 1024 /* DYNAMIC_SLOTS */;
                        }
                    }
                    else if (node.children.length === 1 && vnodeTag !== TELEPORT) {
                        const child = node.children[0];
                        const type = child.type;
                        // check for dynamic text children
                        const hasDynamicTextChild = type === 5 /* INTERPOLATION */ ||
                            type === 8 /* COMPOUND_EXPRESSION */;
                        if (hasDynamicTextChild && !getStaticType(child)) {
                            patchFlag |= 1 /* TEXT */;
                        }
                        // pass directly if the only child is a text node
                        // (plain / interpolation / expression)
                        if (hasDynamicTextChild || type === 2 /* TEXT */) {
                            vnodeChildren = child;
                        }
                        else {
                            vnodeChildren = node.children;
                        }
                    }
                    else {
                        vnodeChildren = node.children;
                    }
                }
                // patchFlag & dynamicPropNames
                if (patchFlag !== 0) {
                    {
                        if (patchFlag < 0) {
                            // special flags (negative and mutually exclusive)
                            vnodePatchFlag = patchFlag + ` /* ${PatchFlagNames[patchFlag]} */`;
                        }
                        else {
                            // bitwise flags
                            const flagNames = Object.keys(PatchFlagNames)
                                .map(Number)
                                .filter(n => n > 0 && patchFlag & n)
                                .map(n => PatchFlagNames[n])
                                .join(`, `);
                            vnodePatchFlag = patchFlag + ` /* ${flagNames} */`;
                        }
                    }
                    if (dynamicPropNames && dynamicPropNames.length) {
                        vnodeDynamicProps = stringifyDynamicPropNames(dynamicPropNames);
                    }
                }
                node.codegenNode = createVNodeCall(context, vnodeTag, vnodeProps, vnodeChildren, vnodePatchFlag, vnodeDynamicProps, vnodeDirectives, !!shouldUseBlock, false /* disableTracking */, node.loc);
            };
        };
        const trackSlotScopes = (node, context) => {
            if (node.type === 1 /* ELEMENT */ &&
                (node.tagType === 1 /* COMPONENT */ ||
                    node.tagType === 3 /* TEMPLATE */)) {
                // We are only checking non-empty v-slot here
                // since we only care about slots that introduce scope variables.
                const vSlot = findDir(node, 'slot');
                if (vSlot) {
                    const slotProps = vSlot.exp;
                    context.scopes.vSlot++;
                    return () => {
                        context.scopes.vSlot--;
                    };
                }
            }
        };
        // Merge adjacent text nodes and expressions into a single expression
        // e.g. <div>abc {{ d }} {{ e }}</div> should have a single expression node as child.
        const transformText = (node, context) => {
            if (node.type === 0 /* ROOT */ ||
                node.type === 1 /* ELEMENT */ ||
                node.type === 11 /* FOR */ ||
                node.type === 10 /* IF_BRANCH */) {
                // perform the transform on node exit so that all expressions have already
                // been processed.
                return () => {
                    const children = node.children;
                    let currentContainer = undefined;
                    let hasText = false;
                    for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        if (isText(child)) {
                            hasText = true;
                            for (let j = i + 1; j < children.length; j++) {
                                const next = children[j];
                                if (isText(next)) {
                                    if (!currentContainer) {
                                        currentContainer = children[i] = {
                                            type: 8 /* COMPOUND_EXPRESSION */,
                                            loc: child.loc,
                                            children: [child]
                                        };
                                    }
                                    // merge adjacent text node into current
                                    currentContainer.children.push(` + `, next);
                                    children.splice(j, 1);
                                    j--;
                                }
                                else {
                                    currentContainer = undefined;
                                    break;
                                }
                            }
                        }
                    }
                    if (!hasText ||
                        // if this is a plain element with a single text child, leave it
                        // as-is since the runtime has dedicated fast path for this by directly
                        // setting textContent of the element.
                        // for component root it's always normalized anyway.
                        (children.length === 1 &&
                            (node.type === 0 /* ROOT */ ||
                                (node.type === 1 /* ELEMENT */ &&
                                    node.tagType === 0 /* ELEMENT */)))) {
                        return;
                    }
                    // pre-convert text nodes into createTextVNode(text) calls to avoid
                    // runtime normalization.
                    for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        if (isText(child) || child.type === 8 /* COMPOUND_EXPRESSION */) {
                            const callArgs = [];
                            // createTextVNode defaults to single whitespace, so if it is a
                            // single space the code could be an empty call to save bytes.
                            if (child.type !== 2 /* TEXT */ || child.content !== ' ') {
                                callArgs.push(child);
                            }
                            // mark dynamic text with flag so it gets patched inside a block
                            if (!context.ssr && child.type !== 2 /* TEXT */) {
                                callArgs.push(`${1 /* TEXT */} /* ${PatchFlagNames[1 /* TEXT */]} */`);
                            }
                            children[i] = {
                                type: 12 /* TEXT_CALL */,
                                content: child,
                                loc: child.loc,
                                codegenNode: createCallExpression(context.helper(CREATE_TEXT), callArgs)
                            };
                        }
                    }
                };
            }
        };

        // 2.2 directiveTransforms
        const transformOn = (dir, node, context, augmentor) => {
            const { loc, modifiers, arg } = dir;
            if (!dir.exp && !modifiers.length) {
                context.onError(createCompilerError(34 /* X_V_ON_NO_EXPRESSION */, loc));
            }
            let eventName;
            if (arg.type === 4 /* SIMPLE_EXPRESSION */) {
                if (arg.isStatic) {
                    const rawName = arg.content;
                    // for @vnode-xxx event listeners, auto convert it to camelCase
                    const normalizedName = rawName.startsWith(`vnode`)
                        ? capitalize(camelize(rawName))
                        : capitalize(rawName);
                    eventName = createSimpleExpression(`on${normalizedName}`, true, arg.loc);
                }
                else {
                    eventName = createCompoundExpression([
                        `"on" + ${context.helperString(CAPITALIZE)}(`,
                        arg,
                        `)`
                    ]);
                }
            }
            else {
                // already a compound expression.
                eventName = arg;
                eventName.children.unshift(`"on" + ${context.helperString(CAPITALIZE)}(`);
                eventName.children.push(`)`);
            }
            // handler processing
            let exp = dir.exp;
            if (exp && !exp.content.trim()) {
                exp = undefined;
            }
            let isCacheable = context.cacheHandlers && !exp;
            if (exp) {
                const isMemberExp = isMemberExpression(exp.content);
                const isInlineStatement = !(isMemberExp || fnExpRE.test(exp.content));
                const hasMultipleStatements = exp.content.includes(`;`);
                {
                    validateBrowserExpression(exp, context, false, hasMultipleStatements);
                }
                if (isInlineStatement || (isCacheable && isMemberExp)) {
                    // wrap inline statement in a function expression
                    exp = createCompoundExpression([
                        `${isInlineStatement ? `$event` : `(...args)`} => ${hasMultipleStatements ? `{` : `(`}`,
                        exp,
                        hasMultipleStatements ? `}` : `)`
                    ]);
                }
            }
            let ret = {
                props: [
                    createObjectProperty(eventName, exp || createSimpleExpression(`() => {}`, false, loc))
                ]
            };
            // apply extended compiler augmentor
            if (augmentor) {
                ret = augmentor(ret);
            }
            if (isCacheable) {
                // cache handlers so that it's always the same handler being passed down.
                // this avoids unnecessary re-renders when users use inline handlers on
                // components.
                ret.props[0].value = context.cache(ret.props[0].value);
            }
            return ret;
        };
        // v-bind without arg is handled directly in ./transformElements.ts due to it affecting
        // codegen for the entire props object. This transform here is only for v-bind
        // *with* args.
        const transformBind = (dir, node, context) => {
            const { exp, modifiers, loc } = dir;
            const arg = dir.arg;
            // .prop is no longer necessary due to new patch behavior
            // .sync is replaced by v-model:arg
            if (modifiers.includes('camel')) {
                if (arg.type === 4 /* SIMPLE_EXPRESSION */) {
                    if (arg.isStatic) {
                        arg.content = camelize(arg.content);
                    }
                    else {
                        arg.content = `${context.helperString(CAMELIZE)}(${arg.content})`;
                    }
                }
                else {
                    arg.children.unshift(`${context.helperString(CAMELIZE)}(`);
                    arg.children.push(`)`);
                }
            }
            if (!exp ||
                (exp.type === 4 /* SIMPLE_EXPRESSION */ && !exp.content.trim())) {
                context.onError(createCompilerError(33 /* X_V_BIND_NO_EXPRESSION */, loc));
                return {
                    props: [createObjectProperty(arg, createSimpleExpression('', true, loc))]
                };
            }
            return {
                props: [createObjectProperty(arg, exp)]
            };
        };
        const transformModel = (dir, node, context) => {
            const { exp, arg } = dir;
            if (!exp) {
                context.onError(createCompilerError(40 /* X_V_MODEL_NO_EXPRESSION */, dir.loc));
                return createTransformProps();
            }
            const expString = exp.type === 4 /* SIMPLE_EXPRESSION */ ? exp.content : exp.loc.source;
            if (!isMemberExpression(expString)) {
                context.onError(createCompilerError(41 /* X_V_MODEL_MALFORMED_EXPRESSION */, exp.loc));
                return createTransformProps();
            }
            const propName = arg ? arg : createSimpleExpression('modelValue', true);
            const eventName = arg
                ? isStaticExp(arg)
                    ? `onUpdate:${arg.content}`
                    : createCompoundExpression(['"onUpdate:" + ', arg])
                : `onUpdate:modelValue`;
            const props = [
                // modelValue: foo
                createObjectProperty(propName, dir.exp),
                // "onUpdate:modelValue": $event => (foo = $event)
                createObjectProperty(eventName, createCompoundExpression([`$event => (`, exp, ` = $event)`]))
            ];
            // modelModifiers: { foo: true, "bar-baz": true }
            if (dir.modifiers.length && node.tagType === 1 /* COMPONENT */) {
                const modifiers = dir.modifiers
                    .map(m => (isSimpleIdentifier(m) ? m : JSON.stringify(m)) + `: true`)
                    .join(`, `);
                const modifiersKey = arg
                    ? isStaticExp(arg)
                        ? `${arg.content}Modifiers`
                        : createCompoundExpression([arg, ' + "Modifiers"'])
                    : `modelModifiers`;
                props.push(createObjectProperty(modifiersKey, createSimpleExpression(`{ ${modifiers} }`, false, dir.loc, true)));
            }
            return createTransformProps(props);
        };

/**
 * 3 转换
 * transform(ast, extend({}, options, {
        prefixIdentifiers,
        nodeTransforms: [
            ...nodeTransforms,
            ...(options.nodeTransforms || []) // user transforms
        ],
        directiveTransforms: extend({}, directiveTransforms, options.directiveTransforms || {} // user transforms
        )
    }));
 */

function transform(root, options) {
    const context = createTransformContext(root, options);
    traverseNode(root, context);
    if (options.hoistStatic) {
        hoistStatic(root, context);
    }
    if (!options.ssr) {
        createRootCodegen(root, context);
    }
    // finalize meta information
    root.helpers = [...context.helpers];
    root.components = [...context.components];
    root.directives = [...context.directives];
    root.imports = [...context.imports];
    root.hoists = context.hoists;
    root.temps = context.temps;
    root.cached = context.cached;
}

        // 3.1 createTransformContext(root, options);
        function createTransformContext(root, { prefixIdentifiers = false, hoistStatic = false, cacheHandlers = false, nodeTransforms = [], directiveTransforms = {}, transformHoist = null, isBuiltInComponent = NOOP, isCustomElement = NOOP, expressionPlugins = [], scopeId = null, ssr = false, ssrCssVars = ``, bindingMetadata = {}, onError = defaultOnError }) {
            const context = {
                // options
                prefixIdentifiers,
                hoistStatic,
                cacheHandlers,
                nodeTransforms,
                directiveTransforms,
                transformHoist,
                isBuiltInComponent,
                isCustomElement,
                expressionPlugins,
                scopeId,
                ssr,
                ssrCssVars,
                bindingMetadata,
                onError,
                // state
                root,
                helpers: new Set(),
                components: new Set(),
                directives: new Set(),
                hoists: [],
                imports: new Set(),
                temps: 0,
                cached: 0,
                identifiers: Object.create(null),
                scopes: {
                    vFor: 0,
                    vSlot: 0,
                    vPre: 0,
                    vOnce: 0
                },
                parent: null,
                currentNode: root,
                childIndex: 0,
                // methods
                helper(name) {
                    context.helpers.add(name);
                    return name;
                },
                helperString(name) {
                    return `_${helperNameMap[context.helper(name)]}`;
                },
                replaceNode(node) {
                    /* istanbul ignore if */
                    {
                        if (!context.currentNode) {
                            throw new Error(`Node being replaced is already removed.`);
                        }
                        if (!context.parent) {
                            throw new Error(`Cannot replace root node.`);
                        }
                    }
                    context.parent.children[context.childIndex] = context.currentNode = node;
                },
                removeNode(node) {
                    if ( !context.parent) {
                        throw new Error(`Cannot remove root node.`);
                    }
                    const list = context.parent.children;
                    const removalIndex = node
                        ? list.indexOf(node)
                        : context.currentNode
                            ? context.childIndex
                            : -1;
                    /* istanbul ignore if */
                    if ( removalIndex < 0) {
                        throw new Error(`node being removed is not a child of current parent`);
                    }
                    if (!node || node === context.currentNode) {
                        // current node removed
                        context.currentNode = null;
                        context.onNodeRemoved();
                    }
                    else {
                        // sibling node removed
                        if (context.childIndex > removalIndex) {
                            context.childIndex--;
                            context.onNodeRemoved();
                        }
                    }
                    context.parent.children.splice(removalIndex, 1);
                },
                onNodeRemoved: () => { },
                addIdentifiers(exp) {
                },
                removeIdentifiers(exp) {
                },
                hoist(exp) {
                    context.hoists.push(exp);
                    const identifier = createSimpleExpression(`_hoisted_${context.hoists.length}`, false, exp.loc, true);
                    identifier.hoisted = exp;
                    return identifier;
                },
                cache(exp, isVNode = false) {
                    return createCacheExpression(++context.cached, exp, isVNode);
                }
            };
            return context;
        }

        // 3.2 traverseNode(node, context)
        function traverseNode(node, context) {
            context.currentNode = node;
            // apply transform plugins
            const { nodeTransforms } = context;
            const exitFns = [];
            for (let i = 0; i < nodeTransforms.length; i++) {
                const onExit = nodeTransforms[i](node, context);
                if (onExit) {
                    if (isArray(onExit)) {
                        exitFns.push(...onExit);
                    }
                    else {
                        exitFns.push(onExit);
                    }
                }
                if (!context.currentNode) {
                    // node was removed
                    return;
                }
                else {
                    // node may have been replaced
                    node = context.currentNode;
                }
            }
            switch (node.type) {
                case 3 /* COMMENT */:
                    if (!context.ssr) {
                        // inject import for the Comment symbol, which is needed for creating
                        // comment nodes with `createVNode`
                        context.helper(CREATE_COMMENT);
                    }
                    break;
                case 5 /* INTERPOLATION */:
                    // no need to traverse, but we need to inject toString helper
                    if (!context.ssr) {
                        context.helper(TO_DISPLAY_STRING);
                    }
                    break;
                // for container types, further traverse downwards
                case 9 /* IF */:
                    for (let i = 0; i < node.branches.length; i++) {
                        traverseNode(node.branches[i], context);
                    }
                    break;
                case 10 /* IF_BRANCH */:
                case 11 /* FOR */:
                case 1 /* ELEMENT */:
                case 0 /* ROOT */:
                    traverseChildren(node, context);
                    break;
            }
            // exit transforms
            context.currentNode = node;
            let i = exitFns.length;
            while (i--) {
                exitFns[i]();
            }
        }