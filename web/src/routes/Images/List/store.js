import { create } from 'zustand';
import {devtools} from "zustand/middleware";
import {closeSnackbar} from "notistack";

const initState = {
    loading: true,
    images: [],
    snackbars: []
};

const store = create(devtools(() => initState));

export const useImageListStore = store;

export const imageListActions = {
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
    setImages: images => {
        store.setState(() => ({
            images,
            loading: false
        }));
    },
    setError: () => {
        store.setState(() => ({
            images: null,
            loading: false
        }));
    }
};
