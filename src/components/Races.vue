<script>
import { fetchRaces } from '../services'
import { ref, onBeforeMount, onMounted, onUpdated, onBeforeUpdate, onErrorCaptured, onBeforeUnmount, onUnmounted } from 'vue'

export default {
  name: 'Races',
  props: {
    version: {
      type: [Number, String],
      default: 1.27
    }
  },
  setup (props) {
    /**
     * Reactive Variables with ref
     */
    const races = ref([])

    const getRaces = async () => {
      races.value = await fetchRaces(props.version)
    }

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
    onMounted(this.getUserRepositories)
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
  },
  mounted () {
    this.getRaces()
  }
}
</script>
