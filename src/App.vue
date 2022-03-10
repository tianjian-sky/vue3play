<template>
    <div id="nav">
        <router-link style="display:block;" v-for="route in $router.options.routes" :key="route.name" :to="route.path">{{route.name}}</router-link>
        Teleport:
        <div id="teleportContainer"></div>
    </div>
    <router-view />
</template>

<style lang="scss">
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
}

#nav {
    padding: 30px;

    a {
        font-weight: bold;
        color: #2c3e50;

        &.router-link-exact-active {
            color: #42b983;
        }
    }
}
</style>
