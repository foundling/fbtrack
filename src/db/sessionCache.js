const SessionCache = function() {

    let _cache = {

        subjectId: null,
        accessToken: null,
        refreshToken: null,   
        signupDate: null

    };

    const get = (prop) => _cache.hasOwnProperty(prop) ? _cache[ prop ] : null;
    const getAll = () => _cache;
    const set = ({ subjectId, accessToken, refreshToken, signupDate }) => {

        _cache = {
            subjectId: subjectId || _cache.subjectId,
            accessToken: accessToken || _cache.accessToken,
            refreshToken: refreshToken || _cache.refreshToken,
            signupDate: signupDate || _cache.signupDate
        };
    }; 
    const toString = () => {
        return JSON.stringify(_cache, null, 2);
    };

    return { get, getAll, set, toString };

};

module.exports = exports = SessionCache;
