<script>
import { fetchRaces } from '../services'
import { ref, toRefs, watch, computed,  onBeforeMount, onMounted, onUpdated, onBeforeUpdate, onErrorCaptured, onBeforeUnmount, onUnmounted } from 'vue'

export default {
  name: 'Races',
  props: {
    version: {
      type: [Number, String],
      default: 1.27
    },
    user: {
      type: String,
    }
  },
  setup (props) {
    /**
     * Reactive Variables with ref
     */
    const races = ref([])

    console.warn('cba', fetchRaces)
    const getRaces = async () => {
      races.value = await fetchRaces(props.version)
    }

    /**
     * watch , toRef
     */
    const { user } = toRefs(props)
    const getUserRepositories = async (newV, oldV) => {
      console.warn('watch到变更', newV, oldV)
    }
    watch(user, getUserRepositories)

    /**
     * computed
     */
    const twiceTheCounter = computed(() => user.value + '--> computedValue')
    console.log(twiceTheCounter.value) // 2

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
      races  // functions returned behave the same as methods
    }
  },
  data () {
    return {
      filters: '',
      searchQuery: ''
    }
  },
  computed: {
    filteredRaces (kword) {
      return this.races.filter(r => {
        return (r.name.includes(kword) || r.nameZH.includes(kword) || r.version === kword)
      })
    },
    racesMatchingSearchQuery () { 
      return this.races.filter(r => {
        return (r.name.includes(this.searchQuery) || r.nameZH.includes(this.searchQuery) || r.version === this.searchQuery)
      })
    },
  },
  watch: {
    version: 'getRaces'
  },
  methods: {
    updateFilters (kword) { 
      this.searchQuery = kword
    }
  }
}
</script>
