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
                forNode.codegenNode = createVNodeCall(
                    context, 
                    helper(FRAGMENT), 
                    undefined, 
                    renderExp, 
                    `${fragmentFlag} /* ${PatchFlagNames[fragmentFlag]} */`, 
                    undefined, 
                    undefined, 
                    true /* isBlock */, 
                    !isStableFragment /* disableTracking */, 
                    node.loc
                );
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

                function createCallExpression(callee, args = [], loc = locStub) {
                    return {
                        type: 14 /* JS_CALL_EXPRESSION */,
                        loc,
                        callee,
                        arguments: args
                    };
                }
                function createObjectProperty(key, value) {
                    return {
                        type: 16 /* JS_PROPERTY */,
                        loc: locStub,
                        key: isString(key) ? createSimpleExpression(key, true) : key,
                        value
                    };
                }
                function createSimpleExpression(content, isStatic, loc = locStub, isConstant = false) {
                    return {
                        type: 4 /* SIMPLE_EXPRESSION */,
                        loc,
                        isConstant,
                        content,
                        isStatic
                    };
                }
                function createFunctionExpression(params, returns = undefined, newline = false, isSlot = false, loc = locStub) {
                    return {
                        type: 18 /* JS_FUNCTION_EXPRESSION */,
                        params,
                        returns,
                        newline,
                        isSlot,
                        loc
                    };
                }
                function createForLoopParams({ value, key, index }) {
                    const params = [];
                    if (value) {
                        params.push(value);
                    }
                    if (key) {
                        if (!value) {
                            params.push(createSimpleExpression(`_`, false));
                        }
                        params.push(key);
                    }
                    if (index) {
                        if (!key) {
                            if (!value) {
                                params.push(createSimpleExpression(`_`, false));
                            }
                            params.push(createSimpleExpression(`__`, false));
                        }
                        params.push(index);
                    }
                    return params;
                }
                function createVNodeCall(context, tag, props, children, patchFlag, dynamicProps, directives, isBlock = false, disableTracking = false, loc = locStub) {
                    if (context) {
                        if (isBlock) {
                            context.helper(OPEN_BLOCK);
                            context.helper(CREATE_BLOCK);
                        }
                        else {
                            context.helper(CREATE_VNODE);
                        }
                        if (directives) {
                            context.helper(WITH_DIRECTIVES);
                        }
                    }
                    return {
                        type: 13 /* VNODE_CALL */,
                        tag,
                        props,
                        children,
                        patchFlag,
                        dynamicProps,
                        directives,
                        isBlock,
                        disableTracking,
                        loc
                    };
                }
                // AST Utilities ---------------------------------------------------------------
                // Some expressions, e.g. sequence and conditional expressions, are never
                // associated with template nodes, so their source locations are just a stub.
                // Container types like CompoundExpression also don't need a real location.
                const locStub = {
                    source: '',
                    start: { line: 1, column: 1, offset: 0 },
                    end: { line: 1, column: 1, offset: 0 }
                };
                
                // Patch flags are optimization hints generated by the compiler.
                // when a block with dynamicChildren is encountered during diff, the algorithm
                // enters "optimized mode". In this mode, we know that the vdom is produced by
                // a render function generated by the compiler, so the algorithm only needs to
                // handle updates explicitly marked by these patch flags.
                // dev only flag -> name mapping
                const PatchFlagNames = {
                    [1 /* TEXT */]: `TEXT`,
                    [2 /* CLASS */]: `CLASS`,
                    [4 /* STYLE */]: `STYLE`,
                    [8 /* PROPS */]: `PROPS`,
                    [16 /* FULL_PROPS */]: `FULL_PROPS`,
                    [32 /* HYDRATE_EVENTS */]: `HYDRATE_EVENTS`,
                    [64 /* STABLE_FRAGMENT */]: `STABLE_FRAGMENT`,
                    [128 /* KEYED_FRAGMENT */]: `KEYED_FRAGMENT`,
                    [256 /* UNKEYED_FRAGMENT */]: `UNKEYED_FRAGMENT`,
                    [512 /* NEED_PATCH */]: `NEED_PATCH`,
                    [1024 /* DYNAMIC_SLOTS */]: `DYNAMIC_SLOTS`,
                    [-1 /* HOISTED */]: `HOISTED`,
                    [-2 /* BAIL */]: `BAIL`
                };

            function createObjectProperty(key, value) {
                return {
                    type: 16 /* JS_PROPERTY */,
                    loc: locStub,
                    key: isString(key) ? createSimpleExpression(key, true) : key,
                    value
                };
            }
        
        // target-agnostic transform used for both Client and SSR
        function processFor(node, dir, context, processCodegen) {
            if (!dir.exp) {
                context.onError(createCompilerError(30 /* X_V_FOR_NO_EXPRESSION */, dir.loc));
                return;
            }
            const parseResult = parseForExpression(
            // can only be simple expression because vFor transform is applied
            // before expression transform.
            dir.exp, context);
            if (!parseResult) {
                context.onError(createCompilerError(31 /* X_V_FOR_MALFORMED_EXPRESSION */, dir.loc));
                return;
            }
            const { addIdentifiers, removeIdentifiers, scopes } = context;
            const { source, value, key, index } = parseResult;
            const forNode = {
                type: 11 /* FOR */,
                loc: dir.loc,
                source,
                valueAlias: value,
                keyAlias: key,
                objectIndexAlias: index,
                parseResult,
                children: isTemplateNode(node) ? node.children : [node]
            };
            context.replaceNode(forNode);
            // bookkeeping
            scopes.vFor++;
            const onExit = processCodegen && processCodegen(forNode);
            return () => {
                scopes.vFor--;
                if (onExit)
                    onExit();
            };
        }

        const forNode = {
            type: 11 /* FOR */,
            loc: dir.loc,
            source,
            valueAlias: value,
            keyAlias: key,
            objectIndexAlias: index,
            parseResult,
            children: isTemplateNode(node) ? node.children : [node]
        };





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
            function isSlotOutlet(node) {
                return node.type === 1 /* ELEMENT */ && node.tagType === 2 /* SLOT */;
            }
            function processSlotOutlet(node, context) {
                let slotName = `"default"`;
                let slotProps = undefined;
                // check for <slot name="xxx" OR :name="xxx" />
                const name = findProp(node, 'name');
                if (name) {
                    if (name.type === 6 /* ATTRIBUTE */ && name.value) {
                        // static name
                        slotName = JSON.stringify(name.value.content);
                    }
                    else if (name.type === 7 /* DIRECTIVE */ && name.exp) {
                        // dynamic name
                        slotName = name.exp;
                    }
                }
                const propsWithoutName = name
                    ? node.props.filter(p => p !== name)
                    : node.props;
                if (propsWithoutName.length > 0) {
                    const { props, directives } = buildProps(node, context, propsWithoutName);
                    slotProps = props;
                    if (directives.length) {
                        context.onError(createCompilerError(35 /* X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET */, directives[0].loc));
                    }
                }
                return {
                    slotName,
                    slotProps
                };
            }
            function buildProps(node, context, props = node.props, ssr = false) {
                const { tag, loc: elementLoc } = node;
                const isComponent = node.tagType === 1 /* COMPONENT */;
                let properties = [];
                const mergeArgs = [];
                const runtimeDirectives = [];
                // patchFlag analysis
                let patchFlag = 0;
                let hasRef = false;
                let hasClassBinding = false;
                let hasStyleBinding = false;
                let hasHydrationEventBinding = false;
                let hasDynamicKeys = false;
                let hasVnodeHook = false;
                const dynamicPropNames = [];
                const analyzePatchFlag = ({ key, value }) => {


                    // if (content.startsWith('[')) {
                    //     isStatic = false;
                    //     if (!content.endsWith(']')) {
                    //         emitError(context, 26 /* X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END */);
                    //     }
                    //     content = content.substr(1, content.length - 2);
                    // }

                    if (isStaticExp(key)) {             // const isStaticExp = (p) => p.type === 4 /* SIMPLE_EXPRESSION */ && p.isStatic;
                        const name = key.content;
                        const isEventHandler = isOn(name);
                        if (!isComponent &&
                            isEventHandler &&
                            // omit the flag for click handlers because hydration gives click
                            // dedicated fast path.
                            name.toLowerCase() !== 'onclick' &&
                            // omit v-model handlers
                            name !== 'onUpdate:modelValue' &&
                            // omit onVnodeXXX hooks
                            !isReservedProp(name)) {
                            hasHydrationEventBinding = true;
                        }
                        if (isEventHandler && isReservedProp(name)) {
                            hasVnodeHook = true;
                        }
                        if (value.type === 20 /* JS_CACHE_EXPRESSION */ ||
                            ((value.type === 4 /* SIMPLE_EXPRESSION */ ||
                                value.type === 8 /* COMPOUND_EXPRESSION */) &&
                                getStaticType(value) > 0)) {
                            // skip if the prop is a cached handler or has constant value
                            return;
                        }
                        if (name === 'ref') {
                            hasRef = true;
                        }
                        else if (name === 'class' && !isComponent) {
                            hasClassBinding = true;
                        }
                        else if (name === 'style' && !isComponent) {
                            hasStyleBinding = true;
                        }
                        else if (name !== 'key' && !dynamicPropNames.includes(name)) {
                            dynamicPropNames.push(name);
                        }
                    }
                    else {
                        hasDynamicKeys = true;
                    }
                };
                for (let i = 0; i < props.length; i++) {
                    // static attribute
                    const prop = props[i];
                    if (prop.type === 6 /* ATTRIBUTE */) {
                        const { loc, name, value } = prop;
                        if (name === 'ref') {
                            hasRef = true;
                        }
                        // skip :is on <component>
                        if (name === 'is' && tag === 'component') {
                            continue;
                        }
                        properties.push(createObjectProperty(
                                createSimpleExpression(name, true, getInnerRange(loc, 0, name.length)), 
                                createSimpleExpression(value ? value.content : '', true, value ? value.loc : loc)
                            )
                        );
                    }
                    else {
                        // directives
                        const { name, arg, exp, loc } = prop;
                        const isBind = name === 'bind';
                        const isOn = name === 'on';
                        // skip v-slot - it is handled by its dedicated transform.
                        if (name === 'slot') {
                            if (!isComponent) {
                                context.onError(createCompilerError(39 /* X_V_SLOT_MISPLACED */, loc));
                            }
                            continue;
                        }
                        // skip v-once - it is handled by its dedicated transform.
                        if (name === 'once') {
                            continue;
                        }
                        // skip v-is and :is on <component>
                        if (name === 'is' ||
                            (isBind && tag === 'component' && isBindKey(arg, 'is'))) { // 参考parseAttribute
                            continue;
                        }
                        // skip v-on in SSR compilation
                        if (isOn && ssr) {
                            continue;
                        }
                        // special case for v-bind and v-on with no argument
                        if (!arg && (isBind || isOn)) {  // 参考parseAttribute
                            hasDynamicKeys = true;
                            if (exp) {
                                if (properties.length) {
                                    mergeArgs.push(createObjectExpression(dedupeProperties(properties), elementLoc));
                                    properties = [];
                                }
                                if (isBind) {
                                    mergeArgs.push(exp);
                                }
                                else {
                                    // v-on="obj" -> toHandlers(obj)
                                    mergeArgs.push({
                                        type: 14 /* JS_CALL_EXPRESSION */,
                                        loc,
                                        callee: context.helper(TO_HANDLERS),
                                        arguments: [exp]
                                    });
                                }
                            }
                            else {
                                context.onError(createCompilerError(isBind
                                    ? 33 /* X_V_BIND_NO_EXPRESSION */
                                    : 34 /* X_V_ON_NO_EXPRESSION */, loc));
                            }
                            continue;
                        }
                        const directiveTransform = context.directiveTransforms[name]; // on, bind. model
                        if (directiveTransform) {
                            // has built-in directive transform.
                            const { props, needRuntime } = directiveTransform(prop, node, context);
                            !ssr && props.forEach(analyzePatchFlag);
                            properties.push(...props);
                            if (needRuntime) {
                                runtimeDirectives.push(prop);
                                if (isSymbol(needRuntime)) {
                                    directiveImportMap.set(prop, needRuntime);
                                }
                            }
                        }
                        else {
                            // no built-in transform, this is a user custom directive.
                            runtimeDirectives.push(prop);
                        }
                    }
                }
                let propsExpression = undefined;
                // has v-bind="object" or v-on="object", wrap with mergeProps
                if (mergeArgs.length) {
                    if (properties.length) {
                        mergeArgs.push(createObjectExpression(dedupeProperties(properties), elementLoc));
                    }
                    if (mergeArgs.length > 1) {
                        propsExpression = createCallExpression(context.helper(MERGE_PROPS), mergeArgs, elementLoc);
                    }
                    else {
                        // single v-bind with nothing else - no need for a mergeProps call
                        propsExpression = mergeArgs[0];
                    }
                }
                else if (properties.length) {
                    propsExpression = createObjectExpression(dedupeProperties(properties), elementLoc);
                }
                // patchFlag analysis
                if (hasDynamicKeys) {
                    patchFlag |= 16 /* FULL_PROPS */;
                }
                else {
                    if (hasClassBinding) {
                        patchFlag |= 2 /* CLASS */;
                    }
                    if (hasStyleBinding) {
                        patchFlag |= 4 /* STYLE */;
                    }
                    if (dynamicPropNames.length) {
                        patchFlag |= 8 /* PROPS */;
                    }
                    if (hasHydrationEventBinding) {
                        patchFlag |= 32 /* HYDRATE_EVENTS */;
                    }
                }
                if ((patchFlag === 0 || patchFlag === 32 /* HYDRATE_EVENTS */) &&
                    (hasRef || hasVnodeHook || runtimeDirectives.length > 0)) {
                    patchFlag |= 512 /* NEED_PATCH */;
                }
                return {
                    props: propsExpression,
                    directives: runtimeDirectives,
                    patchFlag,
                    dynamicPropNames
                };
            }
                    // Dedupe props in an object literal.
                    // Literal duplicated attributes would have been warned during the parse phase,
                    // however, it's possible to encounter duplicated `onXXX` handlers with different
                    // modifiers. We also need to merge static and dynamic class / style attributes.
                    // - onXXX handlers / style: merge into array
                    // - class: merge into single expression with concatenation
                    function dedupeProperties(properties) {
                        const knownProps = new Map();
                        const deduped = [];
                        for (let i = 0; i < properties.length; i++) {
                            const prop = properties[i];
                            // dynamic keys are always allowed
                            if (prop.key.type === 8 /* COMPOUND_EXPRESSION */ || !prop.key.isStatic) { // onXXX
                                deduped.push(prop);
                                continue;
                            }
                            const name = prop.key.content;
                            const existing = knownProps.get(name);
                            if (existing) {
                                if (name === 'style' || name === 'class' || name.startsWith('on')) {
                                    mergeAsArray(existing, prop);
                                }
                                // unexpected duplicate, should have emitted error during parse
                            }
                            else {
                                knownProps.set(name, prop);
                                deduped.push(prop);
                            }
                        }
                        return deduped;
                    }
                    function createArrayExpression(elements, loc = locStub) {
                        return {
                            type: 17 /* JS_ARRAY_EXPRESSION */,
                            loc,
                            elements
                        };
                    }

                    function getStaticType(node, resultCache = new Map()) {
                        switch (node.type) {
                            case 1 /* ELEMENT */:
                                if (node.tagType !== 0 /* ELEMENT */) {
                                    return 0 /* NOT_STATIC */;
                                }
                                const cached = resultCache.get(node);
                                if (cached !== undefined) {
                                    return cached;
                                }
                                const codegenNode = node.codegenNode;
                                if (codegenNode.type !== 13 /* VNODE_CALL */) {
                                    return 0 /* NOT_STATIC */;
                                }
                                const flag = getPatchFlag(codegenNode);
                                if (!flag && !hasNonHoistableProps(node)) {
                                    // element self is static. check its children.
                                    let returnType = 1 /* FULL_STATIC */;
                                    for (let i = 0; i < node.children.length; i++) {
                                        const childType = getStaticType(node.children[i], resultCache);
                                        if (childType === 0 /* NOT_STATIC */) {
                                            resultCache.set(node, 0 /* NOT_STATIC */);
                                            return 0 /* NOT_STATIC */;
                                        }
                                        else if (childType === 2 /* HAS_RUNTIME_CONSTANT */) {
                                            returnType = 2 /* HAS_RUNTIME_CONSTANT */;
                                        }
                                    }
                                    // check if any of the props contain runtime constants
                                    if (returnType !== 2 /* HAS_RUNTIME_CONSTANT */) {
                                        for (let i = 0; i < node.props.length; i++) {
                                            const p = node.props[i];
                                            if (p.type === 7 /* DIRECTIVE */ &&
                                                p.name === 'bind' &&
                                                p.exp &&
                                                (p.exp.type === 8 /* COMPOUND_EXPRESSION */ ||
                                                    p.exp.isRuntimeConstant)) {
                                                returnType = 2 /* HAS_RUNTIME_CONSTANT */;
                                            }
                                        }
                                    }
                                    // only svg/foreignObject could be block here, however if they are
                                    // stati then they don't need to be blocks since there will be no
                                    // nested updates.
                                    if (codegenNode.isBlock) {
                                        codegenNode.isBlock = false;
                                    }
                                    resultCache.set(node, returnType);
                                    return returnType;
                                }
                                else {
                                    resultCache.set(node, 0 /* NOT_STATIC */);
                                    return 0 /* NOT_STATIC */;
                                }
                            case 2 /* TEXT */:
                            case 3 /* COMMENT */:
                                return 1 /* FULL_STATIC */;
                            case 9 /* IF */:
                            case 11 /* FOR */:
                            case 10 /* IF_BRANCH */:
                                return 0 /* NOT_STATIC */;
                            case 5 /* INTERPOLATION */:
                            case 12 /* TEXT_CALL */:
                                return getStaticType(node.content, resultCache);
                            case 4 /* SIMPLE_EXPRESSION */:
                                return node.isConstant
                                    ? node.isRuntimeConstant
                                        ? 2 /* HAS_RUNTIME_CONSTANT */
                                        : 1 /* FULL_STATIC */
                                    : 0 /* NOT_STATIC */;
                            case 8 /* COMPOUND_EXPRESSION */:
                                let returnType = 1 /* FULL_STATIC */;
                                for (let i = 0; i < node.children.length; i++) {
                                    const child = node.children[i];
                                    if (isString(child) || isSymbol(child)) {
                                        continue;
                                    }
                                    const childType = getStaticType(child, resultCache);
                                    if (childType === 0 /* NOT_STATIC */) {
                                        return 0 /* NOT_STATIC */;
                                    }
                                    else if (childType === 2 /* HAS_RUNTIME_CONSTANT */) {
                                        returnType = 2 /* HAS_RUNTIME_CONSTANT */;
                                    }
                                }
                                return returnType;
                            default:
                                return 0 /* NOT_STATIC */;
                        }
                    }

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
                // function createVNodeCall(context, tag, props, children, patchFlag, dynamicProps, directives, isBlock = false, disableTracking = false, loc = locStub) 
                node.codegenNode = createVNodeCall(context, vnodeTag, vnodeProps, vnodeChildren, vnodePatchFlag, vnodeDynamicProps, vnodeDirectives, !!shouldUseBlock, false /* disableTracking */, node.loc);
            };
        };

        function stringifyDynamicPropNames(props) {
            let propsNamesString = `[`;
            for (let i = 0, l = props.length; i < l; i++) {
                propsNamesString += JSON.stringify(props[i]);
                if (i < l - 1)
                    propsNamesString += ', ';
            }
            return propsNamesString + `]`;
        }

        /**
         * Even for a node with no patch flag, it is possible for it to contain
         * non-hoistable expressions that refers to scope variables, e.g. compiler
         * injected keys or cached event handlers. Therefore we need to always check the
         * codegenNode's props to be sure.
         */
        function hasNonHoistableProps(node) {
            const props = getNodeProps(node);
            if (props && props.type === 15 /* JS_OBJECT_EXPRESSION */) {
                const { properties } = props;
                for (let i = 0; i < properties.length; i++) {
                    const { key, value } = properties[i];
                    if (key.type !== 4 /* SIMPLE_EXPRESSION */ ||
                        !key.isStatic ||
                        (value.type !== 4 /* SIMPLE_EXPRESSION */ ||
                            (!value.isStatic && !value.isConstant))) {
                        return true;
                    }
                }
            }
            return false;
        }



        const vModelSelect = {
            created(el, binding, vnode) {
                addEventListener(el, 'change', () => {
                    const selectedVal = Array.prototype.filter
                        .call(el.options, (o) => o.selected)
                        .map(getValue);
                    el._assign(el.multiple ? selectedVal : selectedVal[0]);
                });
                el._assign = getModelAssigner(vnode);
            },
            // set value in mounted & updated because <select> relies on its children
            // <option>s.
            mounted(el, { value }) {
                setSelected(el, value);
            },
            beforeUpdate(el, _binding, vnode) {
                el._assign = getModelAssigner(vnode);
            },
            updated(el, { value }) {
                setSelected(el, value);
            }
        };


        /**
         * 
         * node.type:0 ROOT 1 ELEMENT 2 TEXT 3 COMMENT 4 SIMPLE_EXPRESSION  5 INTERPOLATION 8 COMPOUND_EXPRESSION 9 IF 10 IF_BRANCH IF 11 FOR 12 TEXT_CALL
         * 
         * static type 0 NOT_STATIC 1 FULL_STATIC  2 HAS_RUNTIME_CONSTANT
         * tagtype: 0 element 1 template 2 slot
         * 
         * codegennode.patchFlag -2 BAIL -1 HOISTED 1 TEXT 2 CLASS 4 STYLE 8 PROPS 16 FULL_PROPS 32 HYDRATE_EVENTS 64 STABLE_FRAGMENT 128 KEYED_FRAGMENT 256 UNKEYED_FRAGMENT 512 NEED_PATCH 1024 DYNAMIC_SLOTS
         * 
         */

        function getStaticType(node, resultCache = new Map()) { // 0 NOT_STATIC 1 FULL_STATIC  2 HAS_RUNTIME_CONSTANT
            switch (node.type) {
                case 1 /* ELEMENT */:
                    if (node.tagType !== 0 /* ELEMENT */) {
                        return 0 /* NOT_STATIC */;
                    }
                    const cached = resultCache.get(node);
                    if (cached !== undefined) {
                        return cached;
                    }
                    const codegenNode = node.codegenNode;
                    if (codegenNode.type !== 13 /* VNODE_CALL */) {
                        return 0 /* NOT_STATIC */;
                    }
                    const flag = getPatchFlag(codegenNode);
                    if (!flag && !hasNonHoistableProps(node)) {
                        // element self is static. check its children.
                        let returnType = 1 /* FULL_STATIC */;
                        for (let i = 0; i < node.children.length; i++) {
                            const childType = getStaticType(node.children[i], resultCache);
                            if (childType === 0 /* NOT_STATIC */) {
                                resultCache.set(node, 0 /* NOT_STATIC */);
                                return 0 /* NOT_STATIC */;
                            }
                            else if (childType === 2 /* HAS_RUNTIME_CONSTANT */) {
                                returnType = 2 /* HAS_RUNTIME_CONSTANT */;
                            }
                        }
                        // check if any of the props contain runtime constants
                        if (returnType !== 2 /* HAS_RUNTIME_CONSTANT */) {
                            for (let i = 0; i < node.props.length; i++) {
                                const p = node.props[i];
                                if (p.type === 7 /* DIRECTIVE */ &&
                                    p.name === 'bind' &&
                                    p.exp &&
                                    (p.exp.type === 8 /* COMPOUND_EXPRESSION */ ||
                                        p.exp.isRuntimeConstant)) {
                                    returnType = 2 /* HAS_RUNTIME_CONSTANT */;
                                }
                            }
                        }
                        // only svg/foreignObject could be block here, however if they are
                        // stati then they don't need to be blocks since there will be no
                        // nested updates.
                        if (codegenNode.isBlock) {
                            codegenNode.isBlock = false;
                        }
                        resultCache.set(node, returnType);
                        return returnType;
                    }
                    else {
                        resultCache.set(node, 0 /* NOT_STATIC */);
                        return 0 /* NOT_STATIC */;
                    }
                case 2 /* TEXT */:
                case 3 /* COMMENT */:
                    return 1 /* FULL_STATIC */;
                case 9 /* IF */:
                case 11 /* FOR */:
                case 10 /* IF_BRANCH */:
                    return 0 /* NOT_STATIC */;
                case 5 /* INTERPOLATION */:
                case 12 /* TEXT_CALL */:
                    return getStaticType(node.content, resultCache);
                case 4 /* SIMPLE_EXPRESSION */:
                    return node.isConstant
                        ? node.isRuntimeConstant
                            ? 2 /* HAS_RUNTIME_CONSTANT */
                            : 1 /* FULL_STATIC */
                        : 0 /* NOT_STATIC */;
                case 8 /* COMPOUND_EXPRESSION */:
                    let returnType = 1 /* FULL_STATIC */;
                    for (let i = 0; i < node.children.length; i++) {
                        const child = node.children[i];
                        if (isString(child) || isSymbol(child)) {
                            continue;
                        }
                        const childType = getStaticType(child, resultCache);
                        if (childType === 0 /* NOT_STATIC */) {
                            return 0 /* NOT_STATIC */;
                        }
                        else if (childType === 2 /* HAS_RUNTIME_CONSTANT */) {
                            returnType = 2 /* HAS_RUNTIME_CONSTANT */;
                        }
                    }
                    return returnType;
                default:
                    return 0 /* NOT_STATIC */;
            }
        }
            /**
             * context.scopes
             * scopes: {
                    vFor: 0,
                    vSlot: 0,
                    vPre: 0,
                    vOnce: 0
                },
             */
                function isCoreComponent(tag) {
                    if (isBuiltInType(tag, 'Teleport')) {
                        return TELEPORT;
                    }
                    else if (isBuiltInType(tag, 'Suspense')) {
                        return SUSPENSE;
                    }
                    else if (isBuiltInType(tag, 'KeepAlive')) {
                        return KEEP_ALIVE;
                    }
                    else if (isBuiltInType(tag, 'BaseTransition')) {
                        return BASE_TRANSITION;
                    }
                }


                const buildClientSlotFn = (props, children, loc) => {
                    createFunctionExpression(props, children, false /* newline */, true /* isSlot */, children.length ? children[0].loc : loc);
                }
                function createFunctionExpression(params, returns = undefined, newline = false, isSlot = false, loc = locStub) {
                    return {
                        type: 18 /* JS_FUNCTION_EXPRESSION */,
                        params,
                        returns,
                        newline,
                        isSlot,
                        loc
                    };
                }

                function buildDynamicSlot(name, fn) {
                    return createObjectExpression([
                        createObjectProperty(`name`, name),
                        createObjectProperty(`fn`, fn)
                    ]);
                }

                function createConditionalExpression(test, consequent, alternate, newline = true) {
                    return {
                        type: 19 /* JS_CONDITIONAL_EXPRESSION */,
                        test,
                        consequent,
                        alternate,
                        newline,
                        loc: locStub
                    };
                }
                function createForLoopParams({ value, key, index }) {
                    const params = [];
                    if (value) {
                        params.push(value);
                    }
                    if (key) {
                        if (!value) {
                            params.push(createSimpleExpression(`_`, false));
                        }
                        params.push(key);
                    }
                    if (index) {
                        if (!key) {
                            if (!value) {
                                params.push(createSimpleExpression(`_`, false));
                            }
                            params.push(createSimpleExpression(`__`, false));
                        }
                        params.push(index);
                    }
                    return params;
                }
                // Instead of being a DirectiveTransform, v-slot processing is called during
                // transformElement to build the slots object for a component.
                function buildSlots(node, context, buildSlotFn = buildClientSlotFn) {
                    context.helper(WITH_CTX);
                    const { children, loc } = node;
                    const slotsProperties = [];
                    const dynamicSlots = [];
                    const buildDefaultSlotProperty = (props, children) => createObjectProperty(`default`, buildSlotFn(props, children, loc));
                    // If the slot is inside a v-for or another v-slot, force it to be dynamic
                    // since it likely uses a scope variable.
                    
                    let hasDynamicSlots = context.scopes.vSlot > 0 || context.scopes.vFor > 0;
                    // 1. Check for slot with slotProps on component itself.
                    //    <Comp v-slot="{ prop }"/>
                    const onComponentSlot = findDir(node, 'slot', true);
                    if (onComponentSlot) {
                        const { arg, exp } = onComponentSlot;
                        if (arg && !isStaticExp(arg)) {
                            hasDynamicSlots = true;
                        }
                        slotsProperties.push(createObjectProperty(arg || createSimpleExpression('default', true), buildSlotFn(exp, children, loc)));
                    }
                    // 2. Iterate through children and check for template slots
                    //    <template v-slot:foo="{ prop }">
                    let hasTemplateSlots = false;
                    let hasNamedDefaultSlot = false;
                    const implicitDefaultChildren = [];
                    const seenSlotNames = new Set();
                    for (let i = 0; i < children.length; i++) {
                        const slotElement = children[i];
                        let slotDir;
                        if (!isTemplateNode(slotElement) ||
                            !(slotDir = findDir(slotElement, 'slot', true))) {
                            // not a <template v-slot>, skip.
                            if (slotElement.type !== 3 /* COMMENT */) {
                                implicitDefaultChildren.push(slotElement);
                            }
                            continue;
                        }
                        if (onComponentSlot) {
                            // already has on-component slot - this is incorrect usage.
                            context.onError(createCompilerError(36 /* X_V_SLOT_MIXED_SLOT_USAGE */, slotDir.loc));
                            break;
                        }
                        hasTemplateSlots = true;
                        const { children: slotChildren, loc: slotLoc } = slotElement;
                        const { arg: slotName = createSimpleExpression(`default`, true), exp: slotProps, loc: dirLoc } = slotDir;
                        // check if name is dynamic.
                        let staticSlotName;
                        if (isStaticExp(slotName)) {
                            staticSlotName = slotName ? slotName.content : `default`;
                        }
                        else {
                            hasDynamicSlots = true;
                        }
                        const slotFunction = buildSlotFn(slotProps, slotChildren, slotLoc);
                        // check if this slot is conditional (v-if/v-for)
                        let vIf;
                        let vElse;
                        let vFor;
                        if ((vIf = findDir(slotElement, 'if'))) {
                            hasDynamicSlots = true;
                            dynamicSlots.push(createConditionalExpression(vIf.exp, buildDynamicSlot(slotName, slotFunction), defaultFallback));
                        }
                        else if ((vElse = findDir(slotElement, /^else(-if)?$/, true /* allowEmpty */))) {
                            // find adjacent v-if
                            let j = i;
                            let prev;
                            while (j--) {
                                prev = children[j];
                                if (prev.type !== 3 /* COMMENT */) {
                                    break;
                                }
                            }
                            if (prev && isTemplateNode(prev) && findDir(prev, 'if')) {
                                // remove node
                                children.splice(i, 1);
                                i--;
                                // attach this slot to previous conditional
                                let conditional = dynamicSlots[dynamicSlots.length - 1];
                                while (conditional.alternate.type === 19 /* JS_CONDITIONAL_EXPRESSION */) {
                                    conditional = conditional.alternate;
                                }
                                conditional.alternate = vElse.exp
                                    ? createConditionalExpression(vElse.exp, buildDynamicSlot(slotName, slotFunction), defaultFallback)
                                    : buildDynamicSlot(slotName, slotFunction);
                            }
                            else {
                                context.onError(createCompilerError(29 /* X_V_ELSE_NO_ADJACENT_IF */, vElse.loc));
                            }
                        }
                        else if ((vFor = findDir(slotElement, 'for'))) {
                            hasDynamicSlots = true;
                            const parseResult = vFor.parseResult ||
                                parseForExpression(vFor.exp, context);
                            if (parseResult) {
                                // Render the dynamic slots as an array and add it to the createSlot()
                                // args. The runtime knows how to handle it appropriately.
                                dynamicSlots.push(createCallExpression(context.helper(RENDER_LIST), [
                                    parseResult.source,
                                    createFunctionExpression(createForLoopParams(parseResult), buildDynamicSlot(slotName, slotFunction), true /* force newline */)
                                ]));
                            }
                            else {
                                context.onError(createCompilerError(31 /* X_V_FOR_MALFORMED_EXPRESSION */, vFor.loc));
                            }
                        }
                        else {
                            // check duplicate static names
                            if (staticSlotName) {
                                if (seenSlotNames.has(staticSlotName)) {
                                    context.onError(createCompilerError(37 /* X_V_SLOT_DUPLICATE_SLOT_NAMES */, dirLoc));
                                    continue;
                                }
                                seenSlotNames.add(staticSlotName);
                                if (staticSlotName === 'default') {
                                    hasNamedDefaultSlot = true;
                                }
                            }
                            slotsProperties.push(createObjectProperty(slotName, slotFunction));
                        }
                    }
                    if (!onComponentSlot) {
                        if (!hasTemplateSlots) {
                            // implicit default slot (on component)
                            slotsProperties.push(buildDefaultSlotProperty(undefined, children));
                        }
                        else if (implicitDefaultChildren.length) {
                            // implicit default slot (mixed with named slots)
                            if (hasNamedDefaultSlot) {
                                context.onError(createCompilerError(38 /* X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN */, implicitDefaultChildren[0].loc));
                            }
                            else {
                                slotsProperties.push(buildDefaultSlotProperty(undefined, implicitDefaultChildren));
                            }
                        }
                    }
                    const slotFlag = hasDynamicSlots
                        ? 2 /* DYNAMIC */
                        : hasForwardedSlots(node.children)
                            ? 3 /* FORWARDED */
                            : 1 /* STABLE */;
                    let slots = createObjectExpression(slotsProperties.concat(createObjectProperty(`_`, 
                    // 2 = compiled but dynamic = can skip normalization, but must run diff
                    // 1 = compiled and static = can skip normalization AND diff as optimized
                    createSimpleExpression('' + slotFlag, false))), loc);
                    if (dynamicSlots.length) {
                        slots = createCallExpression(context.helper(CREATE_SLOTS), [
                            slots,
                            createArrayExpression(dynamicSlots)
                        ]);
                    }
                    return {
                        slots,
                        hasDynamicSlots
                    };
                }
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

        function hoistStatic(root, context) {
            walk(root, context, new Map(), 
            // Root node is unfortunately non-hoistable due to potential parent
            // fallthrough attributes.
            isSingleElementRoot(root, root.children[0]));
        }
        /**
         * context.hoists: []
         */
        function hoist(exp) {
            context.hoists.push(exp);
            const identifier = createSimpleExpression(`_hoisted_${context.hoists.length}`, false, exp.loc, true);
            identifier.hoisted = exp;
            return identifier;
        }
        function isSingleElementRoot(root, child) {
            const { children } = root;
            return (children.length === 1 &&
                child.type === 1 /* ELEMENT */ &&
                !isSlotOutlet(child));
        }
        function walk(node, context, resultCache, doNotHoistNode = false) {
            let hasHoistedNode = false;
            // Some transforms, e.g. transformAssetUrls from @vue/compiler-sfc, replaces
            // static bindings with expressions. These expressions are guaranteed to be
            // constant so they are still eligible for hoisting, but they are only
            // available at runtime and therefore cannot be evaluated ahead of time.
            // This is only a concern for pre-stringification (via transformHoist by
            // @vue/compiler-dom), but doing it here allows us to perform only one full
            // walk of the AST and allow `stringifyStatic` to stop walking as soon as its
            // stringficiation threshold is met.
            let hasRuntimeConstant = false;
            const { children } = node;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                // only plain elements & text calls are eligible for hoisting.
                if (child.type === 1 /* ELEMENT */ &&
                    child.tagType === 0 /* ELEMENT */) {
                    let staticType;
                    if (!doNotHoistNode &&
                        (staticType = getStaticType(child, resultCache)) > 0) {
                        if (staticType === 2 /* HAS_RUNTIME_CONSTANT */) {
                            hasRuntimeConstant = true;
                        }
                        child.codegenNode.patchFlag =
                            -1 /* HOISTED */ + ( ` /* HOISTED */` );
                        child.codegenNode = context.hoist(child.codegenNode);
                        hasHoistedNode = true;
                        continue;
                    }
                    else {
                        // node may contain dynamic children, but its props may be eligible for
                        // hoisting.
                        const codegenNode = child.codegenNode;
                        if (codegenNode.type === 13 /* VNODE_CALL */) {
                            const flag = getPatchFlag(codegenNode);
                            if ((!flag ||
                                flag === 512 /* NEED_PATCH */ ||
                                flag === 1 /* TEXT */) &&
                                !hasNonHoistableProps(child)) {
                                const props = getNodeProps(child);
                                if (props) {
                                    codegenNode.props = context.hoist(props);
                                }
                            }
                        }
                    }
                }
                else if (child.type === 12 /* TEXT_CALL */) {
                    const staticType = getStaticType(child.content, resultCache);
                    if (staticType > 0) {
                        if (staticType === 2 /* HAS_RUNTIME_CONSTANT */) {
                            hasRuntimeConstant = true;
                        }
                        child.codegenNode = context.hoist(child.codegenNode);
                        hasHoistedNode = true;
                    }
                }
                // walk further
                if (child.type === 1 /* ELEMENT */) {
                    walk(child, context, resultCache);
                }
                else if (child.type === 11 /* FOR */) {
                    // Do not hoist v-for single child because it has to be a block
                    walk(child, context, resultCache, child.children.length === 1);
                }
                else if (child.type === 9 /* IF */) {
                    for (let i = 0; i < child.branches.length; i++) {
                        // Do not hoist v-if single child because it has to be a block
                        walk(child.branches[i], context, resultCache, child.branches[i].children.length === 1);
                    }
                }
            }
            if (!hasRuntimeConstant && hasHoistedNode && context.transformHoist) {
                context.transformHoist(children, context, node);
            }
        }

        function createRootCodegen(root, context) {
            const { helper } = context;
            const { children } = root;
            if (children.length === 1) {
                const child = children[0];
                // if the single child is an element, turn it into a block.
                if (isSingleElementRoot(root, child) && child.codegenNode) {
                    // single element root is never hoisted so codegenNode will never be
                    // SimpleExpressionNode
                    const codegenNode = child.codegenNode;
                    if (codegenNode.type === 13 /* VNODE_CALL */) {
                        codegenNode.isBlock = true;
                        helper(OPEN_BLOCK);
                        helper(CREATE_BLOCK);
                    }
                    root.codegenNode = codegenNode;
                }
                else {
                    // - single <slot/>, IfNode, ForNode: already blocks.
                    // - single text node: always patched.
                    // root codegen falls through via genNode()
                    root.codegenNode = child;
                }
            }
            else if (children.length > 1) {
                // root has multiple nodes - return a fragment block.
                // createVNodeCall(context, tag, props, children, patchFlag, dynamicProps, directives, isBlock = false, disableTracking = false, loc = locStub) {
                root.codegenNode = createVNodeCall(context, helper(FRAGMENT), undefined, root.children, `${64 /* STABLE_FRAGMENT */} /* ${PatchFlagNames[64 /* STABLE_FRAGMENT */]} */`, undefined, undefined, true);
            }
            else ;
        }