<template>
    <div class="about">
        <h1 ref="domRef">{{count}}</h1>
        <button @click="increment">增加</button>
        <button @click="stop">停止监听</button>
    </div>
</template>


<script>
import { ref, unref, watchEffect, effectScope } from 'vue'

/**
 * effectScope
 * 这样，在run中定义的所有计算属性，在调用了scope对象的stop()方法之后，所有的依赖都被停止了。
 */

export default {
    name: 'WatchEffect',
    components: {},
    setup(/*props, context*/) {
        const count = ref(0)
        const domRef = ref(null)

        const scope = effectScope()

        scope.run(() => {
            watchEffect(
                onInvalidate => {
                    console.log('pre watcher', count.value, unref(domRef) && unref(domRef).innerHTML)
                    onInvalidate(() => {
                        console.warn('pre onInvalidate执行了', count.value, unref(domRef) && unref(domRef).innerHTML)
                    })
                },
                {
                    flush: 'pre'
                }
            )
            watchEffect(
                onInvalidate => {
                    console.log('sync watcher', count.value, unref(domRef) && unref(domRef).innerHTML)
                    onInvalidate(() => {
                        console.warn('sync onInvalidate执行了', count.value, unref(domRef) && unref(domRef).innerHTML)
                    })
                },
                {
                    flush: 'sync'
                }
            )
            watchEffect(
                onInvalidate => {
                    console.log('post watcher', count.value, unref(domRef) && unref(domRef).innerHTML)
                    onInvalidate(() => {
                        console.warn('post onInvalidate执行了', count.value, unref(domRef) && unref(domRef).innerHTML)
                    })
                },
                {
                    flush: 'post'
                }
            )
        })

        return { count, domRef, scope }
    },
    methods: {
        increment() {
            this.count++
        },
        stop() {
            this.scope.stop()
        }
    }
}
</script>
