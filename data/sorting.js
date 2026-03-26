/**
 * QSL-BY-BUREAU / WebQSLForge - Core Logic Module
 * Version: 1.1.0
 * * This module centralizes QSL identification and sorting.
 * It fetches the master prefix list and provides a standardized 
 * way to sort logs across different applications.
 */

const QSLManager = {
    prefixData: null,
    dataSource: 'https://raw.githubusercontent.com/rSignal86/QSL-BY-BUREAU/main/data/prefixList.json',

    /**
     * INITIALIZATION
     * Loads the JSON data from GitHub to stay updated with the latest rules.
     */
    async boot() {
        try {
            const response = await fetch(this.dataSource);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.prefixData = await response.json();
            console.log(`QSLManager: Booted version ${this.prefixData.version}`);
            return true;
        } catch (error) {
            console.error('QSLManager: Initialization failed:', error);
            return false;
        }
    },

    /**
     * IDENTIFICATION
     * Determines country and bureau status using the "Longest Match" method.
     */
    identify(callsign) {
        if (!this.prefixData || !this.prefixData.countries) return null;

        let cleanCall = callsign.toUpperCase().trim();

        // Handle portable suffixes (e.g., LA/G4ABC -> use LA)
        if (cleanCall.includes('/')) {
            const parts = cleanCall.split('/');
            // Use the part that is likely the prefix (usually the shorter one)
            cleanCall = (parts[0].length <= 3) ? parts[0] : (parts[1].length <= 3 ? parts[1] : parts[0]);
        }

        // Search prefixes from 4 characters down to 1
        for (let i = 4; i >= 1; i--) {
            const searchPrefix = cleanCall.substring(0, i);
            for (const [countryName, data] of Object.entries(this.prefixData.countries)) {
                if (data.prefixes.includes(searchPrefix)) {
                    return {
                        country: countryName,
                        hasBureau: data.hasQSLSortService,
                        intervals: data.displayIntervals
                    };
                }
            }
        }
        return null; 
    },

    /**
     * SORTING
     * Simple and efficient sorting: 
     * 1. Bureau status (Available first)
     * 2. Country name (Alphabetical)
     * 3. Callsign (Alphabetical)
     */
    sortQSLs(qsoArray) {
        return qsoArray
            .map(qso => {
                const info = this.identify(qso.callsign);
                return {
                    ...qso,
                    _country: info ? info.country : "UNKNOWN",
                    _hasBureau: info ? info.hasBureau : false
                };
            })
            .sort((a, b) => {
                // Primary: Bureau availability
                if (a._hasBureau !== b._hasBureau) return a._hasBureau ? -1 : 1;
                
                // Secondary: Country Name
                if (a._country !== b._country) return a._country.localeCompare(b._country);
                
                // Tertiary: Callsign
                return a.callsign.localeCompare(b.callsign);
            });
    },

    /**
     * UTILITY
     * Returns a quick status for the UI.
     */
    getStatusLabel(callsign) {
        const info = this.identify(callsign);
        if (!info) return "UNKNOWN";
        return info.hasBureau ? info.country : `${info.country} (NO BUREAU)`;
    }
};
