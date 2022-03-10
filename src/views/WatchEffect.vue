<template>
    <div class="about">
        <h1 ref="domRef">{{count}}</h1>
        <button @click="increment">增加</button>
    </div>
</template>


<script>
import { ref, unref, watchEffect, getCurrentInstance } from 'vue'

/**
 * setup() 方法中如何访问$refs
 * watchEffect三种执行时机
 * watchEffect invalidate参数
 */

/**
    watchEffect的onInvalidate

    使side effect无效
    什么是side effect ,不可预知的接口请求就是一个 side effect
    假设我们现在用一个用户ID去查询用户的详情信息，然后我们监听了这个用户ID,当用户ID 改变的时候我们就会去发起一次请求，这很简单，用watch 就可以做到。
    但是如果在请求数据的过程中，我们的用户ID发生了多次变化，那么我们就会发起多次请求，而最后一次返回的数据将会覆盖掉我们之前返回的所有用户详情。

    这不仅会导致资源浪费，还无法保证 watch 回调执行的顺序。而使用 watchEffect 我们就可以做到。
    onInvalidate(fn)传入的回调会在 watchEffect 重新运行或者 watchEffect 停止的时候执行

    有时副作用函数会执行一些异步的副作用，这些响应需要在其失效时清除 (即完成之前状态已改变了) 。所以侦听副作用传入的函数可以接收一个 onInvalidate 函数作入参，用来注册清理失效时的回调。当以下情况发生时，这个失效回调会被触发：
    1.副作用即将重新执行时
    2.侦听器被停止 (如果在 setup() 或生命周期钩子函数中使用了 watchEffect，则在组件卸载时)
*/

export default {
    name: 'WatchEffect',
    components: {},
    setup(/*props, context*/) {
        const count = ref(0)
        const domRef = ref(null)
        watchEffect(
            onInvalidate => {
                console.log('pre watcher', count.value, unref(domRef) && unref(domRef).innerHTML, getCurrentInstance().$refs)
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
        return { count, domRef }
    },
    methods: {
        increment() {
            this.count++
        }
    }
}
</script>
