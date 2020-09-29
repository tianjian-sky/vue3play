import mockData from '../configs/mockData'


export default {
    fetchRaces (version) {
        return new Promise((res) => {
            res(mockData.RACES.map(r => r.version = version))
        })
    }
}