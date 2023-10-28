import { create } from 'zustand';
import {devtools} from "zustand/middleware";
import {closeSnackbar} from "notistack";

const initState = {
    loading: true,
    containers: [],
    snackbars: []
};

const store = create(devtools(() => initState));

export const useContainerListStore = store;

export const containerListActions = {
    reset: () => {
        store.setState(state => {
            for (const key of state.snackbars) {
                closeSnackbar(key);
            }
            return initState;
        });
    },
    pushSnackbarKey: key => {
        store.setState(state => {
            return {snackbars: [...state.snackbars, key]};
        });
    },
    setContainers: containers => {
        store.setState(() => ({
            containers,
            loading: false
        }));
    },
    setError: () => {
        store.setState(() => ({
            containers: null,
            loading: false
        }));
    }
};
