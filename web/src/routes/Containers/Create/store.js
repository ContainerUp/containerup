import { create } from 'zustand';
import { produce } from "immer";
import {devtools} from "zustand/middleware";

const initialContainerState = {
    name: '',
    imageDetail: null,
    cmd: undefined,
    workDir: undefined,
    envs: [],
    volumes: [],
    ports: [],
    res: {
        cpuShares: 0,
        cpuCores: 0,
        memoryMB: 0,
        memorySwapMB: 0
    },
    adv: {
        start: true,
        alwaysRestart: false
    }
};

const total = 7;
const allFalse = [...new Array(total)].map(() => false);
const allZero = [...new Array(total)].map(() => 0);

const initialUiState = {
    open: [true, false, false, false, false, false, false],
    disabled: [false, true, true, true, true, true, true],
    version: allZero,
    edited: allFalse,
    dialogDiscardIntent: {
        index: 0,
        open: false
    },
    showDialogDiscard: false
};

const store = create(devtools(() => ({
    ...initialContainerState,
    ...initialUiState
})));

export const useContainerStore = store;

export const containerActions = {
    reset: () => {
        store.setState(() => initialContainerState);
    },
    setName: name => {
        store.setState(() => ({name}));
    },
    setImageDetail: imageDetail => {
        store.setState(() => ({imageDetail}));
    },
    setCmd: cmd => {
        store.setState(() => ({cmd}));
    },
    setWorkDir: workDir => {
        store.setState(() => ({workDir}));
    },
    setEnvs: envs => {
        store.setState(() => ({envs}));
    },
    setVolumes: volumes => {
        store.setState(() => ({volumes}));
    },
    setPorts: ports => {
        store.setState(() => ({ports}));
    },
    setRes: res => {
        store.setState(() => ({res}));
    },
    setAdv: adv => {
        store.setState(() => ({adv}));
    }
};

export const uiActions = {
    reset: () => {
        store.setState(() => initialUiState);
    },
    toggle: (index, open, zeroHasImageDetail = false) => {
        store.setState(state => {
            if (index === 0 && !zeroHasImageDetail) {
                // zero: accordion name image
                // it's ok to open/close accordionNameImage
                if (open) {
                    // open only one
                    return {
                        open: allFalse.map((val, idx) => idx === 0)
                    };
                }
                // open none
                return {
                    open: allFalse
                };
            }

            if (!open && state.edited[index]) {
                // close current one
                return {
                    showDialogDiscard: true,
                    dialogDiscardIntent: {
                        index,
                        open
                    }
                };
            }

            if (open) {
                if (state.edited.indexOf(true) !== -1) {
                    // open other one
                    return {
                        showDialogDiscard: true,
                        dialogDiscardIntent: {
                            index,
                            open
                        }
                    };
                }
            }

            // close all, or open only one
            return {
                open: allFalse.map((val, idx) => {
                    if (index === idx) {
                        return open;
                    }
                    return false;
                })
            };
        });
    },
    openNext: index => {
        store.setState(() => {
            let idxToOpen = index + 1;
            if (idxToOpen >= total) {
                idxToOpen = -1;
            }
            return {
                open: allFalse.map((v, idx) => idx === idxToOpen)
            };
        });
    },
    enableAll: () => {
        store.setState(() => ({disabled: allFalse}));
    },
    setEdited: (index, edited) => {
        store.setState(produce(state => {
            state.edited[index] = edited;
        }));
    },
    closeDialog: () => {
        store.setState(() => ({showDialogDiscard: false}));
    },
    confirmDiscard: () => {
        store.setState(produce(state => {
            const toReset = state.edited.indexOf(true);
            state.version[toReset] ++;
            state.edited[toReset] = false;
            state.showDialogDiscard = false;

            // close, or open only one
            state.open = allFalse.map((val, idx) => {
                if (state.dialogDiscardIntent.index === idx) {
                    return state.dialogDiscardIntent.open;
                }
                return false;
            });
        }));
    }
};
