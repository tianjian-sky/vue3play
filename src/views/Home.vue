<template>
  <div class="home">
    <img alt="Vue logo" src="../assets/logo.png">
    <Banner msg="Welcome to Your Vue.js App"/>
    <Heros msg="To be continued..."/>
    <Races user="admin"/>
  </div>
</template>

<script>
// @ is an alias to /src
import Banner from '@/components/Banner'
import Heros from '@/components/Heros.vue'
import Races from '@/components/Races.vue'

export default {
  name: 'Home',
  components: {
    Heros,
    Banner,
    Races,
  }
}
</script>
