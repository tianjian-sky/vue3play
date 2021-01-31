<template>
    <teleport to="#teleportContainer">
        <div>
            传送内容
        </div>
    </teleport>
</template>

<script>
import {onMounted} from 'vue'

export default {
    setup() {
        onMounted(()=>{})
        return {}
    }
}
</script>

<style lang="scss" scoped>

</style>