import { ref, h } from 'vue'

export default {
    setup(props, { expose }) {
        const priate_v = ref('private')
        const public_v = ref('public')
        expose({
            public: public_v,
            private: priate_v
        })
        return () => h('div', 'setup()返回了渲染函数，则不能再返回其他 property。如果需要将 property 暴露给外部访问，比如通过父组件的 ref，可以使用 expose')
    }
}

