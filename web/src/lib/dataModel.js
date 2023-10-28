import axios from 'axios';
import Pipe from "./Pipe";
import TwoWayPipe from "./TwoWayPipe";
import {receiveOnlyWebsocket} from "./wsHelper";

const prefix = '/api';
const sessionKeyName = 'containerup_key';
let loginKey = sessionStorage.getItem(sessionKeyName);

const errors = {
    errNoLogin: new Error('not logged in'),
    errWebsocket: new Error('cannot connect websocket')
};

const cacheContainerInspect = {};

const getLoginKeyAndPrefix = () => {
    return [loginKey, prefix];
};

const login = (username, password) => {
    return axios.post(prefix + '/login', {
        username: username,
        password: password
    })
        .then(resp => {
            loginKey = resp.data.key;
            sessionStorage.setItem(sessionKeyName, loginKey);
        });
};

const logout = () => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }
    const key = loginKey;

    loginKey = '';
    sessionStorage.removeItem(sessionKeyName);

    return axios.post(prefix + '/logout', {
    }, {
        headers: {
            Authorization: 'Bearer ' + key
        }
    });
};

const containerList = (abortController) => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }
    return axios.get(prefix + '/container', {
        signal: abortController.signal,
        headers: {
            Authorization: 'Bearer ' + loginKey
        }
    })
        .then(resp => resp.data);
};

const containerAction = (containerId, action, abortController) => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }
    return axios.post(prefix + '/container/' + containerId, action,{
        signal: abortController.signal,
        headers: {
            Authorization: 'Bearer ' + loginKey
        }
    })
        .then(resp => resp.data);
};

const containerInspect = (containerId, readCache, abortController) => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }

    if (readCache && cacheContainerInspect[containerId]) {
        return Promise.resolve(cacheContainerInspect[containerId].data);
    }

    return axios.get(prefix + '/container/' + containerId + '/inspect', {
        signal: abortController.signal,
        headers: {
            Authorization: 'Bearer ' + loginKey
        }
    })
        .then(resp => {
            if (resp.data) {
                if (cacheContainerInspect[containerId]) {
                    // data is replaced
                    clearTimeout(cacheContainerInspect[containerId].timeout);
                }

                cacheContainerInspect[containerId] = {
                    data: resp.data,
                    timeout: setTimeout(() => {
                        delete cacheContainerInspect[containerId];
                    }, 5000)
                };
            }
            return resp.data;
        });
};

const containerLogs = (containerId, logOpts) => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }

    logOpts = Object.assign({
        follow: false,
        tail: true,
        tailNum: 1000
    }, logOpts);

    let protocol = 'ws:';
    if (window.location.protocol === 'https:') {
        protocol = 'wss:';
    }
    let url = protocol + '//' + window.location.host + prefix + '/container/' + containerId + '/logs';

    const q = new URLSearchParams();
    if (logOpts.follow) {
        q.set('follow', '1');
    }
    if (logOpts.tail) {
        q.set('tail', logOpts.tailNum);
    }
    const queryStr = q.toString();
    if (queryStr) {
        url += '?' + queryStr;
    }

    return receiveOnlyWebsocket(url, loginKey);
};

const containerExec = (containerId, execOpts) => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }

    let protocol = 'ws:';
    if (window.location.protocol === 'https:') {
        protocol = 'wss:';
    }
    let url = protocol + '//' + window.location.host + prefix + '/container/' + containerId + '/exec';

    const q = new URLSearchParams();
    q.set('cmd', execOpts.cmd);
    if (execOpts.tty) {
        q.set('tty', '1');
    }
    if (execOpts.interactive) {
        q.set('interactive', '1');
    }
    url += '?' + q.toString();

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    const canceler = () => {
        // console.log('dm: ws close while handshaking')
        ws.close(1000, 'canceled');
    };

    return [new Promise((resolve, reject) => {
        const twoWayPipe = new TwoWayPipe();

        // xterm (left side) <==========> (right side) websocket

        const leftSide = twoWayPipe.useLeft();
        const rightSide = twoWayPipe.useRight();
        const rightSideWriter = rightSide.useWriter();
        const rightSideOnReceive = rightSide.useOnReceive();

        const closePipe = new Pipe();
        const closeWriter = closePipe.useWriter();

        let open = false;
        let errClosed = false;
        ws.addEventListener('message', event => {
            rightSideWriter(event.data);
        });
        ws.addEventListener('open', () => {
            ws.send(loginKey);

            open = true;
            resolve({
                onReceive: leftSide.useOnReceive(),
                write: leftSide.useWriter(),
                onClose: closePipe.useOnReceive(),
                close: () => {
                    // console.log('dm: ws close now')
                    ws.close(1000, 'user terminated the session');
                }
            });

            rightSideOnReceive(d => ws.send(d));
        });
        ws.addEventListener('error', () => {
            if (!open) {
                reject(errors.errWebsocket);
                return;
            }
            ws.close();
            closeWriter({code: -1, reason: 'websocket error'});
            errClosed = true;
        });
        ws.addEventListener('close', event => {
            if (errClosed) {
                return;
            }
            const {code, reason} = event;
            ws.close();
            closeWriter({code, reason});
        });
    }), canceler];
};

const containerCreate = (containerSpec, abortController) => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }
    return axios.post(prefix + '/container', containerSpec, {
        signal: abortController.signal,
        headers: {
            Authorization: 'Bearer ' + loginKey
        }
    })
        .then(resp => resp.data);
};

const imageList = (abortController) => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }
    return axios.get(prefix + '/image', {
        signal: abortController.signal,
        headers: {
            Authorization: 'Bearer ' + loginKey
        }
    })
        .then(resp => resp.data);
};

const cacheImageInspect = {};

const imageInspect = (imageId, readCache, abortController) => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }

    if (readCache && cacheImageInspect[imageId]) {
        return Promise.resolve(cacheImageInspect[imageId].data);
    }

    return axios.get(prefix + '/image/' + imageId + '/inspect', {
        signal: abortController.signal,
        headers: {
            Authorization: 'Bearer ' + loginKey
        }
    })
        .then(resp => {
            if (resp.data) {
                if (cacheImageInspect[imageId]) {
                    // data is replaced
                    clearTimeout(cacheImageInspect[imageId].timeout);
                }

                cacheImageInspect[imageId] = {
                    data: resp.data,
                    timeout: setTimeout(() => {
                        delete cacheImageInspect[imageId];
                    }, 5000)
                };
            }
            return resp.data;
        });
};

const imageAction = (imageId, action, abortController) => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }
    return axios.post(prefix + '/image/' + imageId, action,{
        signal: abortController.signal,
        headers: {
            Authorization: 'Bearer ' + loginKey
        }
    })
        .then(resp => resp.data);
};

const imagePull = imageName => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }

    let protocol = 'ws:';
    if (window.location.protocol === 'https:') {
        protocol = 'wss:';
    }
    let url = protocol + '//' + window.location.host + prefix + '/image/pull';

    const q = new URLSearchParams();
    q.set('name', imageName);
    url += '?' + q.toString();

    return receiveOnlyWebsocket(url, loginKey);
};

const systemInfo = (abortController) => {
    if (!loginKey) {
        return Promise.reject(errors.errNoLogin);
    }

    return axios.get(prefix + '/system/info', {
        signal: abortController.signal,
        headers: {
            Authorization: 'Bearer ' + loginKey
        }
    })
        .then(resp => resp.data);
};

const dataModel = {
    errors,
    errIsNoLogin: e => {
        if (e.response && e.response.status === 401) {
            return true;
        }
        return e === errors.errNoLogin;
    },

    getLoginKeyAndPrefix,
    login,
    logout,

    containerList,
    containerAction,
    containerInspect,
    containerLogs,
    containerExec,
    containerCreate,

    imageList,
    imageInspect,
    imageAction,
    imagePull,

    systemInfo
};

export default dataModel;
