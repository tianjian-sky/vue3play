import mockData from '../configs/mockData'

const fetchRaces = function (version) {
    return new Promise((res) => {
        res(mockData.RACES.map(r => r.version = version))
    })
}

export {
    fetchRaces
}