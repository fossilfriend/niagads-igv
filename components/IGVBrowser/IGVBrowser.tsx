"use client";

import React, {
    useLayoutEffect,
    useMemo,
    useState,
    useEffect,
    useRef,
    Suspense,
    lazy
} from "react";

import noop from "lodash.noop";
import find from "lodash.find";

import {
    //VariantPValueTrack,
    VariantServiceTrack as VariantTrack,
    IGVBrowserTrack,
    trackPopover,
} from "./tracks";

import { loadTracks, getLoadedTracks, removeTrackById } from "./decoders/utils";

import { DEFAULT_FLANK } from "./config/_constants";
import { _genomes } from "./config/_igvGenomes";



/* const igv = lazy(() =>
    import("igv/dist/igv.esm").then((mod) => mod.igv)
); */

// import igv from "igv/dist/igv.esm";
interface IGVBrowserProps {
    genome: string;
    featureSearchURI: string;
    tracks?: IGVBrowserTrack[];
    locus?: string;
    onTrackRemoved?: (track: string) => void;
    onBrowserLoad?: (Browser: any) => void;
}

const IGVBrowser: React.FC<IGVBrowserProps> = ({
    genome,
    featureSearchURI,
    locus,
    onBrowserLoad,
    onTrackRemoved,
    tracks,
}) => {
    const [browserIsLoaded, setBrowserIsLoaded] = useState<boolean>(false);
    const [browser, setBrowser] = useState<any>(null);
    const [isClient, setIsClient] = useState(false);
    const [igv, setIGV] = useState<any>(null);
    const [pvalueTrackClass, setPvalueTrackClass] = useState<any>(null);

    const containerRef = useRef(null);

    const opts: any = useMemo(() => {
        const referenceTrackConfig: any = find(_genomes, { id: genome });
        return {
            locus: locus || "APOE",
            showAllChromosomes: false,
            flanking: DEFAULT_FLANK,
            minimumBases: 40,
            search: {
                url: `${featureSearchURI}$FEATURE$&flank=${DEFAULT_FLANK}`,
            },
            reference: referenceTrackConfig,
            loadDefaultGenomes: false,
            genomeList: _genomes,
        };
    }, [genome, locus]);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        // setting initial session due to component load/reload
        if (browserIsLoaded && opts && tracks) {
            const loadedTracks = getLoadedTracks(browser);

            // if any tracks are loaded, remove them
            if (Object.keys(loadedTracks).length !== 0) {
                for (const id of loadedTracks) {
                    removeTrackById(id, browser);
                }
            }

            // load initial tracks
            loadTracks(tracks, browser);
        }
    }, [browserIsLoaded]);

    async function loadTrackClass(trackClass: string) {
        const { default: t} = await import("./tracks/" + trackClass);
        return t
    }

    useLayoutEffect(() => {
        if (isClient && containerRef.current) {
            // lazy load of igv library to avoid `window is not defined` ReferenceError
            async function loadIGV() {
                const { default: mod } = await import("igv/dist/igv.esm");
                setIGV(mod);
            }
            async function loadTrackClasses() {
                const t = await loadTrackClass('VariantPValueTrack')
                setPvalueTrackClass(t);
            }

            if (!igv) {
                loadIGV();
                loadTrackClasses();
            } else {
                const targetDiv = containerRef.current;

                if (opts != null) {
                    igv.registerTrackClass("gwas_service", pvalueTrackClass);
                    // igv.registerTrackClass("qtl", VariantPValueTrack);
                    igv.registerTrackClass("variant_service", VariantTrack);

                    igv.createBrowser(targetDiv, opts).then(function (
                        browser: any
                    ) {
                        // custom track popovers
                        browser.on("trackclick", trackPopover);

                        // perform action in encapsulating component if track is removed
                        browser.on("trackremoved", function (track: any) {
                            if (onTrackRemoved) {
                                onTrackRemoved(track.config.id);
                            }
                        });

                        // add browser to state
                        setBrowser(browser);
                        setBrowserIsLoaded(true);

                        // callback to parent component, if exist
                        if (onBrowserLoad) {
                            onBrowserLoad(browser);
                        } else {
                            noop();
                        }
                    });
                }
            }
        }
    }, [isClient, igv, pvalueTrackClass]);

    if (!isClient && !igv) {
        return <div>Loading...</div>;
    }

    return (
        <>
            <Suspense fallback={<div>Loading...</div>}>
                <span
                    ref={containerRef}
                    style={{ width: "100%" }}
                    id="genome-browser"
                />
            </Suspense>
        </>
    );
};

export const MemoIGVBrowser = React.memo(IGVBrowser);
export default IGVBrowser;
