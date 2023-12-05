import { create } from 'zustand';
import dataModel from "../../lib/dataModel";

const initialUpdateState = {
    update: null,
    checked: false,
    checking: false
};

const updateStore = create(() => initialUpdateState);

export const useUpdateState = updateStore;

export const keyCheckUpdateAuto = "update_check_auto";

export const updateActions = {
    setUpdate: update => {
        if (update && forceImage) {
            update.image = forceImage;
        }
        updateStore.setState(() => ({update, checking: false, checked: true}));
    },
    setChecking: () => {
        updateStore.setState(() => ({checking: true, checked: false}));
    }
};

let checkAutoTimeout = null;
let checkAutoAbort = null;

export const doBackgroundUpdateCheck = () => {
    const emptyCancel = () => {};

    if (localStorage.getItem(keyCheckUpdateAuto) !== '1') {
        return emptyCancel;
    }

    if (updateStore.getState().update) {
        return emptyCancel;
    }

    if (checkAutoTimeout !== null || checkAutoAbort !== null) {
        return emptyCancel;
    }

    checkAutoTimeout = setTimeout(() => {
        checkAutoTimeout = null;
        const ab = new AbortController();

        const p1 = checkNow(ab);
        const p2 = dataModel.systemInfo(ab);
        Promise.all([p1, p2])
            .then(([resp1, resp2]) => {
                const currentVersion = resp2.container_up.version;
                const channel = getChannel(currentVersion);
                const latestInfo = resp1[channel];
                if (!latestInfo) {
                    updateActions.setUpdate(null);
                    console.log("Cannot check update: channel not available");
                    return;
                }
                if (latestInfo.version !== currentVersion) {
                    updateActions.setUpdate(latestInfo);
                }
            })
            .catch(error => {
                updateActions.setUpdate(null);
                console.log("Cannot check update: " + error.toString());
            });

        checkAutoAbort = ab;
    }, 1000);

    return () => {
        if (checkAutoTimeout) {
            clearTimeout(checkAutoTimeout);
            checkAutoTimeout = null;
        }
    };
};

const checkNow = ab => {
    if (checkAutoTimeout) {
        clearTimeout(checkAutoTimeout);
        checkAutoTimeout = null;
    }
    if (checkAutoAbort) {
        checkAutoAbort.abort();
        checkAutoAbort = null;
    }
    updateActions.setChecking();

    if (process.env.REACT_APP_CONTAINERUP_DEMO) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    demo: {
                        version: process.env.REACT_APP_CONTAINERUP_VERSION + '-new',
                        image: 'quay.io/containerup/demo:latest',
                        changelog: 'This is for demo only!\nNo real update will be performed!',
                        compatible_version: 'v0.1.0'
                    }
                });
            }, 1000);
        });
    }

    return dataModel.systemCheckUpdate(ab);
};

export const manuallyCheck = (currentVersion) => {
    checkNow(new AbortController())
        .then(resp => {
            const channel = getChannel(currentVersion);
            const latestInfo = resp[channel];
            if (!latestInfo) {
                updateActions.setUpdate(null);
                console.log("Cannot check update: channel not available");
                return null;
            }
            if (latestInfo.version !== currentVersion) {
                updateActions.setUpdate(latestInfo);
            }
            return latestInfo;
    })
        .catch(error => {
            updateActions.setUpdate(null);
            console.log("Cannot check update: " + error.toString());
        });
};

let forceChannel = '';

export const getChannel = version => {
    if (forceChannel) {
        return forceChannel;
    }
    if (process.env.REACT_APP_CONTAINERUP_DEMO) {
        return 'demo';
    }
    if (version === 'dev') {
        return 'dev';
    }
    if (/^v\d+\.\d+\.\d+-unstable$/.test(version)) {
        return 'unstable';
    }
    if (/^v\d+\.\d+\.\d+$/.test(version)) {
        return 'stable';
    }
    return 'testing';
};

export const setChannel = ch => {
    forceChannel = ch;
};

let forceImage = '';

export const setImage = img => {
    forceImage = img;
};
