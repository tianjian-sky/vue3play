<template>
  <div class="home">
    <img alt="Vue logo" src="../assets/logo.png">
    <Banner msg="Welcome to Your Vue.js App"/>
    <Heros msg="To be continued..."/>
  </div>
</template>

<script>
// @ is an alias to /src
import Banner from '@/components/Banner'
import Heros from '@/components/Heros.vue'
import RacesV2 from '@/components/RacesV2.vue'
import {ref,/*  toRefs, watch, computed, */ onBeforeMount, onMounted} from 'vue'

export default {
  name: 'Home',
  components: {
    Heros,
    Banner,
  },
  setup(props) {
    
    // 接收props
    // const { user, version } = toRefs(props)
    
    
    const version = ref('1.27')
    const user = ref('tj-sky')

    const { getRaces, races, computedRaces } = RacesV2(version, user)
  
    console.warn('setup props', props)
    console.warn('races from setup:', races)
    console.warn('races value from setup:', races.value)
    console.warn('computedRaces from setup:', computedRaces)
    onBeforeMount(() => {
      console.warn('home on befure mount from setup')
    })
    onMounted(() => {
      console.warn('home on mount from setup')
    })
    console.warn( getRaces())
    setTimeout(() => {
      console.warn('races from setup 1000ms later:', races.value)
    }, 1000);
  },
  created () {
    console.warn('home created')
  },
  mounted () {
    console.warn('home mounted')
  }
}
</script>
