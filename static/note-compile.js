const parserOptions = {
    isVoidTag,
    isNativeTag: tag => isHTMLTag(tag) || isSVGTag(tag),
    isPreTag: tag => tag === 'pre',
    decodeEntities:  decodeHtmlBrowser,
    isBuiltInComponent: (tag) => {
        if (isBuiltInType(tag, `Transition`)) {
            return TRANSITION$1;
        }
        else if (isBuiltInType(tag, `TransitionGroup`)) {
            return TRANSITION_GROUP;
        }
    },
    // https://html.spec.whatwg.org/multipage/parsing.html#tree-construction-dispatcher
    getNamespace(tag, parent) {
        let ns = parent ? parent.ns : 0 /* HTML */;
        if (parent && ns === 2 /* MATH_ML */) {
            if (parent.tag === 'annotation-xml') {
                if (tag === 'svg') {
                    return 1 /* SVG */;
                }
                if (parent.props.some(a => a.type === 6 /* ATTRIBUTE */ &&
                    a.name === 'encoding' &&
                    a.value != null &&
                    (a.value.content === 'text/html' ||
                        a.value.content === 'application/xhtml+xml'))) {
                    ns = 0 /* HTML */;
                }
            }
            else if (/^m(?:[ions]|text)$/.test(parent.tag) &&
                tag !== 'mglyph' &&
                tag !== 'malignmark') {
                ns = 0 /* HTML */;
            }
        }
        else if (parent && ns === 1 /* SVG */) {
            if (parent.tag === 'foreignObject' ||
                parent.tag === 'desc' ||
                parent.tag === 'title') {
                ns = 0 /* HTML */;
            }
        }
        if (ns === 0 /* HTML */) {
            if (tag === 'svg') {
                return 1 /* SVG */;
            }
            if (tag === 'math') {
                return 2 /* MATH_ML */;
            }
        }
        return ns;
    },
    // https://html.spec.whatwg.org/multipage/parsing.html#parsing-html-fragments
    getTextMode({ tag, ns }) {
        if (ns === 0 /* HTML */) {
            if (tag === 'textarea' || tag === 'title') {
                return 1 /* RCDATA */;
            }
            if (isRawTextContainer(tag)) {
                return 2 /* RAWTEXT */;
            }
        }
        return 0 /* DATA */;
    }
};
const DOMNodeTransforms = [
    transformStyle,
    ...( [warnTransitionChildren] )
];

let compile

registerRuntimeCompiler(compileToFunction);

function registerRuntimeCompiler(_compile) {
    compile = _compile;
}

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

function compile$1(template, options = {}) {
    return baseCompile(template, extend({}, parserOptions, options, {
        nodeTransforms: [
            // ignore <script> and <tag>
            // this is not put inside DOMNodeTransforms because that list is used
            // by compiler-ssr to generate vnode fallback branches
            ignoreSideEffectTags,
            ...DOMNodeTransforms,
            ...(options.nodeTransforms || [])
        ],
        directiveTransforms: extend({}, DOMDirectiveTransforms, options.directiveTransforms || {}),
        transformHoist:  null 
    }));
}

// we name it `baseCompile` so that higher order compilers like
// @vue/compiler-dom can export `compile` while re-exporting everything else.
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

function defaultOnError(error) {
    throw error;
}

// baseParse template -> ast
function baseParse(content, options = {}) {
    const context = createParserContext(content, options);
    const start = getCursor(context);
    return createRoot(parseChildren(context, 0 /* DATA */, []), getSelection(context, start));
}
function createParserContext(content, rawOptions) {
    const options = extend({}, defaultParserOptions);
    for (const key in rawOptions) {
        // @ts-ignore
        options[key] = rawOptions[key] || defaultParserOptions[key];
    }
    return {
        options,
        column: 1,
        line: 1,
        offset: 0,
        originalSource: content,
        source: content,
        inPre: false,
        inVPre: false
    };
}
function getCursor(context) {
    const { column, line, offset } = context;
    return { column, line, offset };
}
function createRoot(children, loc = locStub) {
    return {
        type: 0 /* ROOT */,
        children,
        helpers: [],
        components: [],
        directives: [],
        hoists: [],
        imports: [],
        cached: 0,
        temps: 0,
        codegenNode: undefined,
        loc
    };
}

// createRoot(parseChildren(context, 0, []), getSelection(context, start));
const defaultParserOptions = {
    delimiters: [`{{`, `}}`],
    getNamespace: () => 0 /* HTML */,
    getTextMode: () => 0 /* DATA */,
    isVoidTag: NO,
    isPreTag: NO,
    isCustomElement: NO,
    decodeEntities: (rawText) => rawText.replace(decodeRE, (_, p1) => decodeMap[p1]),
    onError: defaultOnError,
    comments: false
};
/**
 * namespace
 * 0: html
 * 1: svg
 * 2: MATH_ML
 */
function getNamespace (tag, parent) {
    let ns = parent ? parent.ns : 0 /* HTML */;
    if (parent && ns === 2 /* MATH_ML */) {
        if (parent.tag === 'annotation-xml') {
            if (tag === 'svg') {
                return 1 /* SVG */;
            }
            if (parent.props.some(a => a.type === 6 /* ATTRIBUTE */ &&
                a.name === 'encoding' &&
                a.value != null &&
                (a.value.content === 'text/html' ||
                    a.value.content === 'application/xhtml+xml'))) {
                ns = 0 /* HTML */;
            }
        }
        else if (/^m(?:[ions]|text)$/.test(parent.tag) &&
            tag !== 'mglyph' &&
            tag !== 'malignmark') {
            ns = 0 /* HTML */;
        }
    }
    else if (parent && ns === 1 /* SVG */) {
        if (parent.tag === 'foreignObject' ||
            parent.tag === 'desc' ||
            parent.tag === 'title') {
            ns = 0 /* HTML */;
        }
    }
    if (ns === 0 /* HTML */) {
        if (tag === 'svg') {
            return 1 /* SVG */;
        }
        if (tag === 'math') {
            return 2 /* MATH_ML */;
        }
    }
    return ns;
}

function parseChildren(context, mode, ancestors) {
    const parent = last(ancestors);
    const ns = parent ? parent.ns : 0 /* HTML */;
    const nodes = [];
    while (!isEnd(context, mode, ancestors)) {
        const s = context.source;
        let node = undefined;
        if (mode === 0 /* DATA */ || mode === 1 /* RCDATA */) {
            if (!context.inVPre && startsWith(s, context.options.delimiters[0])) {
                // '{{'
                node = parseInterpolation(context, mode);
            }
            else if (mode === 0 /* DATA */ && s[0] === '<') {
                // https://html.spec.whatwg.org/multipage/parsing.html#tag-open-state
                if (s.length === 1) {
                    emitError(context, 5 /* EOF_BEFORE_TAG_NAME */, 1);
                }
                else if (s[1] === '!') {
                    // https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state
                    if (startsWith(s, '<!--')) {
                        node = parseComment(context);
                    }
                    else if (startsWith(s, '<!DOCTYPE')) {
                        // Ignore DOCTYPE by a limitation.
                        node = parseBogusComment(context);
                    }
                    else if (startsWith(s, '<![CDATA[')) {
                        if (ns !== 0 /* HTML */) {
                            node = parseCDATA(context, ancestors);
                        }
                        else {
                            emitError(context, 1 /* CDATA_IN_HTML_CONTENT */);
                            node = parseBogusComment(context);
                        }
                    }
                    else {
                        emitError(context, 11 /* INCORRECTLY_OPENED_COMMENT */);
                        node = parseBogusComment(context);
                    }
                }
                else if (s[1] === '/') {
                    // https://html.spec.whatwg.org/multipage/parsing.html#end-tag-open-state
                    if (s.length === 2) {
                        emitError(context, 5 /* EOF_BEFORE_TAG_NAME */, 2);
                    }
                    else if (s[2] === '>') {
                        emitError(context, 14 /* MISSING_END_TAG_NAME */, 2);
                        advanceBy(context, 3);
                        continue;
                    }
                    else if (/[a-z]/i.test(s[2])) {
                        emitError(context, 23 /* X_INVALID_END_TAG */);
                        parseTag(context, 1 /* End */, parent);
                        continue;
                    }
                    else {
                        emitError(context, 12 /* INVALID_FIRST_CHARACTER_OF_TAG_NAME */, 2);
                        node = parseBogusComment(context);
                    }
                }
                else if (/[a-z]/i.test(s[1])) {
                    node = parseElement(context, ancestors);
                }
                else if (s[1] === '?') {
                    emitError(context, 21 /* UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME */, 1);
                    node = parseBogusComment(context);
                }
                else {
                    emitError(context, 12 /* INVALID_FIRST_CHARACTER_OF_TAG_NAME */, 1);
                }
            }
        }
        if (!node) {
            node = parseText(context, mode);
        }
        if (isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                pushNode(nodes, node[i]);
            }
        }
        else {
            pushNode(nodes, node);
        }
    }
    // Whitespace management for more efficient output
    // (same as v2 whitespace: 'condense')
    let removedWhitespace = false;
    if (mode !== 2 /* RAWTEXT */) {
        if (!context.inPre) {
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (node.type === 2 /* TEXT */) {
                    if (!/[^\t\r\n\f ]/.test(node.content)) {
                        const prev = nodes[i - 1];
                        const next = nodes[i + 1];
                        // If:
                        // - the whitespace is the first or last node, or:
                        // - the whitespace is adjacent to a comment, or:
                        // - the whitespace is between two elements AND contains newline
                        // Then the whitespace is ignored.
                        if (!prev ||
                            !next ||
                            prev.type === 3 /* COMMENT */ ||
                            next.type === 3 /* COMMENT */ ||
                            (prev.type === 1 /* ELEMENT */ &&
                                next.type === 1 /* ELEMENT */ &&
                                /[\r\n]/.test(node.content))) {
                            removedWhitespace = true;
                            nodes[i] = null;
                        }
                        else {
                            // Otherwise, condensed consecutive whitespace inside the text
                            // down to a single space
                            node.content = ' ';
                        }
                    }
                    else {
                        node.content = node.content.replace(/[\t\r\n\f ]+/g, ' ');
                    }
                }
            }
        }
        else if (parent && context.options.isPreTag(parent.tag)) {
            // remove leading newline per html spec
            // https://html.spec.whatwg.org/multipage/grouping-content.html#the-pre-element
            const first = nodes[0];
            if (first && first.type === 2 /* TEXT */) {
                first.content = first.content.replace(/^\r?\n/, '');
            }
        }
    }
    return removedWhitespace ? nodes.filter(Boolean) : nodes;
}
function getCursor(context) {
    const { column, line, offset } = context;
    return { column, line, offset };
}
function getSelection(context, start, end) {
    end = end || getCursor(context);
    return {
        start,
        end,
        source: context.originalSource.slice(start.offset, end.offset)
    };
}

function advanceBy(context, numberOfCharacters) {
    const { source } = context;
    advancePositionWithMutation(context, source, numberOfCharacters);
    context.source = source.slice(numberOfCharacters);
}
// advance by mutation without cloning (for performance reasons), since this
// gets called a lot in the parser
function advancePositionWithMutation(pos, source, numberOfCharacters = source.length) {
    let linesCount = 0;
    let lastNewLinePos = -1;
    for (let i = 0; i < numberOfCharacters; i++) {
        if (source.charCodeAt(i) === 10 /* newline char code */) {
            linesCount++;
            lastNewLinePos = i;
        }
    }
    pos.offset += numberOfCharacters;
    pos.line += linesCount;
    pos.column =
        lastNewLinePos === -1
            ? pos.column + numberOfCharacters
            : numberOfCharacters - lastNewLinePos;
    return pos;
}
/**
 * TEXT 
 * type: 2
 */

function parseText(context, mode) {
    const endTokens = ['<', context.options.delimiters[0]];
    if (mode === 3 /* CDATA */) {
        endTokens.push(']]>');
    }
    let endIndex = context.source.length;
    for (let i = 0; i < endTokens.length; i++) {
        const index = context.source.indexOf(endTokens[i], 1);
        if (index !== -1 && endIndex > index) {
            endIndex = index;
        }
    }
    const start = getCursor(context);
    const content = parseTextData(context, endIndex, mode);
    return {
        type: 2 /* TEXT */,
        content,
        loc: getSelection(context, start)
    };
}
function parseTextData(context, length, mode) {
    const rawText = context.source.slice(0, length);
    advanceBy(context, length);
    if (mode === 2 /* RAWTEXT */ ||
        mode === 3 /* CDATA */ ||
        rawText.indexOf('&') === -1) {
        return rawText;
    }
    else {
        // DATA or RCDATA containing "&"". Entity decoding required.
        return context.options.decodeEntities(rawText, mode === 4 /* ATTRIBUTE_VALUE */);
    }
}
/**
 * INTERPOLATION {{...}}
 * type: 5
 */

function parseInterpolation(context, mode) {
    const [open, close] = context.options.delimiters;
    const closeIndex = context.source.indexOf(close, open.length);
    if (closeIndex === -1) {
        emitError(context, 25 /* X_MISSING_INTERPOLATION_END */);
        return undefined;
    }
    const start = getCursor(context);
    advanceBy(context, open.length);
    const innerStart = getCursor(context);
    const innerEnd = getCursor(context);
    const rawContentLength = closeIndex - open.length;
    const rawContent = context.source.slice(0, rawContentLength);
    const preTrimContent = parseTextData(context, rawContentLength, mode);
    const content = preTrimContent.trim();
    const startOffset = preTrimContent.indexOf(content);
    if (startOffset > 0) {
        advancePositionWithMutation(innerStart, rawContent, startOffset);
    }
    const endOffset = rawContentLength - (preTrimContent.length - content.length - startOffset);
    advancePositionWithMutation(innerEnd, rawContent, endOffset);
    advanceBy(context, close.length);
    return {
        type: 5 /* INTERPOLATION */,
        content: {
            type: 4 /* SIMPLE_EXPRESSION */,
            isStatic: false,
            // Set `isConstant` to false by default and will decide in transformExpression
            isConstant: false,
            content,
            loc: getSelection(context, innerStart, innerEnd)
        },
        loc: getSelection(context, start)
    };
}
/**
 * SIMPLE_EXPRESSION {{...}}
 * type: 4
 */

/**
 * COMMENT <!DOCTYPE>, <!---->
 * type: 3
 */
function parseComment(context) {
    const start = getCursor(context);
    let content;
    // Regular comment.
    const match = /--(\!)?>/.exec(context.source);
    if (!match) {
        content = context.source.slice(4);
        advanceBy(context, context.source.length);
        emitError(context, 7 /* EOF_IN_COMMENT */);
    }
    else {
        if (match.index <= 3) {
            emitError(context, 0 /* ABRUPT_CLOSING_OF_EMPTY_COMMENT */);
        }
        if (match[1]) {
            emitError(context, 10 /* INCORRECTLY_CLOSED_COMMENT */);
        }
        content = context.source.slice(4, match.index);
        // Advancing with reporting nested comments.
        const s = context.source.slice(0, match.index);
        let prevIndex = 1, nestedIndex = 0;
        while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
            advanceBy(context, nestedIndex - prevIndex + 1);
            if (nestedIndex + 4 < s.length) {
                emitError(context, 16 /* NESTED_COMMENT */);
            }
            prevIndex = nestedIndex + 1;
        }
        advanceBy(context, match.index + match[0].length - prevIndex + 1);
    }
    return {
        type: 3 /* COMMENT */,
        content,
        loc: getSelection(context, start)
    };
}

function parseBogusComment(context) {
    const start = getCursor(context);
    const contentStart = context.source[1] === '?' ? 1 : 2;
    let content;
    const closeIndex = context.source.indexOf('>');
    if (closeIndex === -1) {
        content = context.source.slice(contentStart);
        advanceBy(context, context.source.length);
    }
    else {
        content = context.source.slice(contentStart, closeIndex);
        advanceBy(context, closeIndex + 1);
    }
    return {
        type: 3 /* COMMENT */,
        content,
        loc: getSelection(context, start)
    };
}

// CDATA 指的是不由 XML 解析器进行解析的文本数据。
function parseCDATA(context, ancestors) {
    advanceBy(context, 9);
    const nodes = parseChildren(context, 3 /* CDATA */, ancestors);
    if (context.source.length === 0) {
        emitError(context, 6 /* EOF_IN_CDATA */);
    }
    else {
        advanceBy(context, 3);
    }
    return nodes;
}