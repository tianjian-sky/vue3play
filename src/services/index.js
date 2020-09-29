import mockData from '../configs/mockData'


export default {
    fetchRaces () {
        return new Promise((res) => {
            res(mockData.RACES)
        })
    }
}