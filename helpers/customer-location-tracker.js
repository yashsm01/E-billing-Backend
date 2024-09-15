const axios = require('axios');
const Constants = require('../config/const');

module.exports = {
    trackLocation: async (lat, lng) => {
        try {
            let response = await axios(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&key=AIzaSyAx66_O5KtHzLI05WYw99duzKpT_5qP6nY`);
            if (response.data && response.data.results.length > 0) {
                let interationLimit = (response.data.results.length > 3) ? 3 : response.data.results.length;
                let loopFlag = true;
                let results;
                for (let i = 0; i < interationLimit && loopFlag; i++) {
                    results = response.data.results[i];
                    console.log("results in loop",results);
                    for (let j = 0; j < results.types.length && loopFlag; j++) {
                        if (Constants.placeTypes.includes(results.types[j])) {
                            loopFlag = false;
                            return {
                                status: true,
                                data: {
                                    name: results.name,
                                    storeLat: results.geometry.location.lat,
                                    storeLng: results.geometry.location.lng,
                                    type: results.types[j]
                                }
                            }
                        }
                    }

                    if ((i == interationLimit - 1) && loopFlag) {
                        return {
                            status: false
                        }
                    }
                }

            } else {
                return {
                    status: false
                }
            }

        } catch (error) {
            console.log(error);
            return {
                status: false
            };
        }
    }
}
