function checkJwtToken(jwtUserKey,key){
	return jwtUserKey==key ? true : false;
}
module.exports = { checkJwtToken };