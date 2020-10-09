<script>
import { fetchRaces } from '../services'
import { ref,/* toRefs,*/ watch, computed,  onBeforeMount, onMounted, onUpdated, onBeforeUpdate, onErrorCaptured, onBeforeUnmount, onUnmounted } from 'vue'

export default function racesV2 (version, user) {
    /**
     * Reactive Variables with ref
     */
    const races = ref([])

    const getRaces = async () => {
      races.value = await fetchRaces(version.value)
      return races.value
    }

    /**
     * watch , toRef
     */
    const getUserRepositories = async (newV, oldV) => {
      console.warn('watch到变更', newV, oldV)
    }
    watch(user, getUserRepositories) //  A watch source can only be a getter/effect function, a ref, a reactive object, or an array of these types. 

    /**
     * computed
     */
    const twiceTheCounter = computed(() => user.value + '--> computedValue')
    console.log(twiceTheCounter.value) // 2

    const computedRaces = computed(() => races.value + '--> computedRaces')
    console.log(computedRaces.value) // 2

    /**
     * Lifecycle Hook Registration Inside setup
     */
    onBeforeMount(() => {
      console.log('onBeforeMount:setup lifecyclehook', this)
    })
    onBeforeUpdate(() => {
      console.log('onBeforeUpdate:setup lifecyclehook', this)
    })
    onUpdated(() => {
      console.log('onUpdated:setup lifecyclehook', this)
    })
    onMounted(getRaces)
    onBeforeUnmount(() => {
      console.log('onBeforeUnmount:setup lifecyclehook', this)
    })
    onUnmounted(() => {
      console.log('onUnmounted:setup lifecyclehook', this)
    })
    onErrorCaptured(() => {
      console.log('onErrorCaptured:setup lifecyclehook', this)
    })

    return {
      getRaces,
      races,  // functions returned behave the same as methods
      computedRaces,
    }
}
</script>
