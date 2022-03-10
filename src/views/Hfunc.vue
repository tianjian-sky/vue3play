<template>
    <div class="about">
        <h1>This is an HFunc page</h1>
    </div>
</template>


<script>
import { h, ref } from 'vue'

export default {
    name: 'HFunc',
    components: {},
    setup(/*props, context*/) {
        // const version = ref('1.27')
        // const user = ref('tj-sky')

        /*
         * h(type, props, children)
         * type string|object|function HTML 标签名、组件、异步组件或函数式组件
         * props Object 一个对象，与我们将在模板中使用的 attribute、prop 和事件相对应
         * children String | Array | Object 子代 VNode，使用 h() 生成，或者使用字符串来获取“文本 VNode”，或带有插槽的对象
         *
         * 返回一个”虚拟节点“，通常缩写为 VNode：一个普通对象，其中包含向 Vue 描述它应在页面上渲染哪种节点的信息，包括所有子节点的描述。它的目的是用于手动编写的渲染函数：
         */
        const count = ref('count')
        return () => h('div', count.value) // override template
    },
    methods: {},
    created() {
        console.warn('HFunc created')
    },
    mounted() {
        console.warn('HFunc mounted')
    }
}
</script>
