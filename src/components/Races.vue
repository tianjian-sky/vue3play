<script>
import { fetchRaces } from '../services'
import { ref } from 'vue'

export default {
  name: 'Races',
  props: {
    version: {
      type: [Number, String],
      default: 1.27
    }
  },
  setup (props) {
    const races = ref([])
    const getRaces = async () => {
      races.value = await fetchRaces(props.version)
    }
    return {
      getRaces,
      races  // functions returned behave the same as methods
    }
  }
}
</script>
