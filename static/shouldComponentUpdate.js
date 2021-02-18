/*
* instance.update
*/

/*
* mountComponent -> setupRenderEffect -> instance.update = effect(function componentEffect() {...}
*/


/*
* patch -> processComponent -> updateComponent -> shouldUpdateComponent -?-> instance.update
*                           |-> mountComponent
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
    /* FULL_PROPS */
    /*
    *   hasDynamicKeys = true;
    *   !isStaticExp(key)
    */


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
                    if (isStaticExp(key)) {
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
                        properties.push(
                            createObjectProperty(
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
                            (isBind && tag === 'component' && isBindKey(arg, 'is'))) {
                            continue;
                        }
                        // skip v-on in SSR compilation
                        if (isOn && ssr) {
                            continue;
                        }
                        // special case for v-bind and v-on with no argument
                        // v-bind.camel
                        if (!arg && (isBind || isOn)) {
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
                        /**
                         *  directiveTransform: {
                                on: transformOn,
                                bind: transformBind,
                                model: transformModel
                            }
                         */
                        const directiveTransform = context.directiveTransforms[name];
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

            // const isStaticExp = (p) => p.type === 4 /* SIMPLE_EXPRESSION */ && p.isStatic;
            // isStaticExp ---> hasDynamicKeys
            function createObjectExpression(properties, loc = locStub) {
                return {
                    type: 15 /* JS_OBJECT_EXPRESSION */,
                    loc,
                    properties
                };
            }
            function dedupeProperties(properties) {
                const knownProps = new Map();
                const deduped = [];
                for (let i = 0; i < properties.length; i++) {
                    const prop = properties[i];
                    // dynamic keys are always allowed
                    if (prop.key.type === 8 /* COMPOUND_EXPRESSION */ || !prop.key.isStatic) {
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

    /* PROPS */





    function parseAttribute(context, nameSet) {
        // Name.
        const start = getCursor(context);
        const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
        const name = match[0];
        if (nameSet.has(name)) {
            emitError(context, 2 /* DUPLICATE_ATTRIBUTE */);
        }
        nameSet.add(name);
        if (name[0] === '=') {
            emitError(context, 19 /* UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME */);
        }
        {
            const pattern = /["'<]/g;
            let m;
            while ((m = pattern.exec(name))) {
                emitError(context, 17 /* UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME */, m.index);
            }
        }
        advanceBy(context, name.length);
        // Value
        let value = undefined;
        if (/^[\t\r\n\f ]*=/.test(context.source)) {
            advanceSpaces(context);
            advanceBy(context, 1);
            advanceSpaces(context);
            value = parseAttributeValue(context);
            if (!value) {
                emitError(context, 13 /* MISSING_ATTRIBUTE_VALUE */);
            }
        }
        const loc = getSelection(context, start);
        if (!context.inVPre && /^(v-|:|@|#)/.test(name)) {
            const match = /(?:^v-([a-z0-9-]+))?(?:(?::|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(name);
            const dirName = match[1] ||
                (startsWith(name, ':') ? 'bind' : startsWith(name, '@') ? 'on' : 'slot');
            let arg;
            if (match[2]) {
                const isSlot = dirName === 'slot';
                const startOffset = name.indexOf(match[2]);
                const loc = getSelection(context, getNewPosition(context, start, startOffset), getNewPosition(context, start, startOffset + match[2].length + ((isSlot && match[3]) || '').length));
                let content = match[2];
                let isStatic = true;
                if (content.startsWith('[')) {
                    isStatic = false;
                    if (!content.endsWith(']')) {
                        emitError(context, 26 /* X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END */);
                    }
                    content = content.substr(1, content.length - 2);
                }
                else if (isSlot) {
                    // #1241 special case for v-slot: vuetify relies extensively on slot
                    // names containing dots. v-slot doesn't have any modifiers and Vue 2.x
                    // supports such usage so we are keeping it consistent with 2.x.
                    content += match[3] || '';
                }
                arg = {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content,
                    isStatic,
                    isConstant: isStatic,
                    loc
                };
            }
            /*
            * 没有match[2]的情况:
            * /(?:^v-([a-z0-9-]+))?(?:(?::|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec('v-bind.aaa="ccc"')
            * 
            */
            if (value && value.isQuoted) {
                const valueLoc = value.loc;
                valueLoc.start.offset++;
                valueLoc.start.column++;
                valueLoc.end = advancePositionWithClone(valueLoc.start, value.content);
                valueLoc.source = valueLoc.source.slice(1, -1);
            }
            return {
                type: 7 /* DIRECTIVE */,
                name: dirName,
                exp: value && {
                    type: 4 /* SIMPLE_EXPRESSION */,
                    content: value.content,
                    isStatic: false,
                    // Treat as non-constant by default. This can be potentially set to
                    // true by `transformExpression` to make it eligible for hoisting.
                    isConstant: false,
                    loc: value.loc
                },
                arg,
                modifiers: match[3] ? match[3].substr(1).split('.') : [],
                loc
            };
        }
        return {
            type: 6 /* ATTRIBUTE */,
            name,
            value: value && {
                type: 2 /* TEXT */,
                content: value.content,
                loc: value.loc
            },
            loc
        };
    }



    // 1.shouldComponentUpdate

    // 2. transformOn
    // 2.1 cacheable
    //      context.cacheHandlers && !exp;
    // 2.2 isStatic
        // if (arg.isStatic) {
        //     const rawName = arg.content;
        //     // for @vnode-xxx event listeners, auto convert it to camelCase
        //     const normalizedName = rawName.startsWith(`vnode`)
        //         ? capitalize(camelize(rawName))
        //         : capitalize(rawName);
        //     eventName = createSimpleExpression(`on${normalizedName}`, true, arg.loc);
        // }
        // else {
        //     eventName = createCompoundExpression([
        //         `"on" + ${context.helperString(CAPITALIZE)}(`,
        //         arg,
        //         `)`
        //     ]);
        // }

        // 3. transformBind
        
            // SIMPLE_EXPRESSION
            // COMPOUND_EXPRESSION 多个textNode

                // const transformText = (node, context) => {
                //     // ...
                //         for (let j = i + 1; j < children.length; j++) {
                //             const next = children[j];
                //             if (isText(next)) {
                //                 if (!currentContainer) {
                //                     currentContainer = children[i] = {
                //                         type: 8 /* COMPOUND_EXPRESSION */,
                //                         loc: child.loc,
                //                         children: [child]
                //                     };
                //                 }
                //                 // merge adjacent text node into current
                //                 currentContainer.children.push(` + `, next);
                //                 children.splice(j, 1);
                //                 j--;
                //             }

                //     // ...
                // }
        // 4.transformModel