<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <p>
      For a guide and recipes on how to configure / customize this project,<br>
      check out the
      <a href="https://cli.vuejs.org" target="_blank" rel="noopener">vue-cli documentation</a>.
    </p>
    <p>
      inject value:
    </p>
    <p>
      userLocation:{{userLocation}}
    </p>
    <p>
      userGeolocation:{{userGeolocation}}
    </p>
  </div>
</template>

<script>
import { inject } from 'vue'

export default {
  name: 'Banner',
  props: {
    msg: String
  },
  setup(props) {
    console.log('setup api:', props) // { user: '' }

    const userLocation = inject('location', 'The Universe')
    const userGeolocation = inject('geolocation')

    return {
      userLocation,
      userGeolocation
    } // anything returned here will be available for the rest of the component
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
