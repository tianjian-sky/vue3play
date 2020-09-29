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

export default {
  name: 'Home',
  components: {
    Heros,
    Banner
  }
}
</script>
