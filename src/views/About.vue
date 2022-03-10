<template>
    <div class="about">
        <h1>This is an about page</h1>
    </div>
</template>

<script>
// @ is an alias to /src
// import Banner from '@/components/Banner'
// import Heros from '@/components/Heros.vue'
// import teleportContent from './teleport'
import RacesV2 from '@/components/RacesV2.vue'
import { ref, reactive, provide, /*  toRefs, watch, computed, */ onBeforeMount, onMounted } from 'vue'

export default {
    name: 'About',
    components: {
        // Heros,
        // Banner,
        // teleportContent
    },
    /** ！！
   * When setup is executed, the component instance has not been created yet. As a result, you will only be able to access the following properties:
      props
      attrs
      slots
      emit
    In other words, you will not have access to the following component options:
      data
      computed
      methods
   */
    setup(props, context) {
        // 接收props
        // const { user, version } = toRefs(props)

        /**
         * Inside setup(), this won't be a reference to the current active instance
         * Since setup() is called before other component options are resolved,
         * this inside setup() will behave quite differently from this in other options.
         * This might cause confusions when using setup() along other Options API.
         */
        console.warn('setup this', this)
        console.warn('setup context', context) // {attrs, slots, emit}

        const version = ref('1.27')
        const user = ref('tj-sky')

        const location = ref('North Pole')
        const geolocation = reactive({
            longitude: 90,
            latitude: 135
        })

        const { getRaces, races, computedRaces } = RacesV2(version, user)

        console.warn('setup props', props)
        console.warn('races from setup:', races)
        console.warn('races value from setup:', races.value)
        console.warn('computedRaces from setup:', computedRaces)

        provide('location', location)
        provide('geolocation', geolocation)

        // v-bind:动态key
        const dynamicKey1 = ref('d1')
        const dynamicKey2 = ref('d2')
        const dkey = ref('dynamicKey1')

        onBeforeMount(() => {
            console.warn('home on befure mount from setup')
        })
        onMounted(() => {
            console.warn('home on mount from setup')
        })
        console.warn(getRaces())
        setTimeout(() => {
            console.warn('races from setup 1000ms later:', races.value)
        }, 1000)

        const changeDKey = function () {
            const id = dkey.value.match(/\d/)[0]
            dkey.value = `dynamicKey${id == 1 ? 2 : 1}`
        }
        return {
            dynamicKey1,
            dynamicKey2,
            geolocation,
            location,
            changeDKey,
            dkey
        }
    },
    methods: {
        changeProvide() {
            console.warn(123123, this, this.location)
            /**
             * When a ref is returned as a property on the render context (the object returned from setup()) and accessed in the template,
             *  it automatically unwraps to the inner value. There is no need to append .value in the template:
             */
            this.location = 'South Pole!'
        }
    },
    created() {
        console.warn('About created')
    },
    mounted() {
        console.warn('About mounted')
    }
}
</script>
