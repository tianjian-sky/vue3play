<template>
    <div class="about">
        <div v-margin:[dir]="200">
            This is to explain directive:{{count}}<button @click="count+=1">add</button>
        </div>
    </div>
</template>


<script>
import { ref } from 'vue'

export default {
    name: 'Directive',
    components: {},
    setup(/*props, context*/) {
        const count = ref(1)
        const dir = ref('left')
        return { count, dir }
    },
    directives: {
        margin: {
            created(a, b, c) {
                console.log('directive hook: crated', a, b, c)
            },
            mounted(a, b, c) {
                console.log('directive hook: mounted', a, b, c)
            },
            beforeUpdate(a, b, c) {
                console.log('directive hook: beforeUpdate', a, b, c)
            },
            updated(a, b, c) {
                console.log('directive hook: updated', a, b, c)
            }
        }
    },
    methods: {},
    created() {},
    mounted() {}
}
</script>
