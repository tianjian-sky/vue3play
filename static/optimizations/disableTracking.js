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