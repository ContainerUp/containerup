import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const useGA4 = () => {
    const ga4 = process.env.REACT_APP_CONTAINERUP_GA4;

    useEffect(() => {
        if (!ga4) {
            return;
        }

        window.dataLayer = window.dataLayer || [];
        function gtag(){window.dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', ga4, {
            send_page_view: false
        });

        const script = document.createElement('script');
        script.src = "https://www.googletagmanager.com/gtag/js?id=" + ga4;
        script.async = true;

        document.body.appendChild(script);
        return () => {
            document.body.removeChild(script);
        };
    }, [ga4]);

    const location = useLocation();
    useEffect(() => {
        if (!ga4) {
            return;
        }

        function gtag(){window.dataLayer.push(arguments);}
        gtag("event", "page_view", {
            page_path: location.pathname + location.search + location.hash,
            page_search: location.search,
            page_hash: location.hash,
        });
    }, [ga4, location]);
};
