<template>
    <div class="about">
        <h1>This is to test expose()</h1>
        <Expose ref="child" />
    </div>
</template>


<script>
import Expose from '@/components/Expose'

export default {
    name: 'HFunc',
    components: { Expose },
    setup(/*props, context*/) {},
    methods: {},
    created() {
        console.warn('Expose created')
    },
    mounted() {
        console.warn('Expose mounted')
        console.log(this.$refs['child'].public, this.$refs['child'].private)
    }
}
</script>
