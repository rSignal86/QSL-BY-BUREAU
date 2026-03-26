/**
 * QSL-BY-BUREAU / WebQSLForge - Core Logic Module
 * Version: 1.3.0
 * * SORTING HIERARCHY:
 * 1. Bureau status (Available first)
 * 2. Country Name (Alphabetical A-Z)
 * 3. Prefix Priority (Strictly follows the order in the JSON "prefixes" array)
 * 4. Callsign (Alphabetical fallback)
 */

const QSLManager = {
    prefixData: null,
    dataSource: 'https://raw.githubusercontent.com/rSignal86/QSL-BY-BUREAU/main/data/prefixList.json',

    async boot() {
        try {
            const response = await fetch(this.dataSource);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.prefixData = await response.json();
            console.log(`QSLManager: Booted. Version ${this.prefixData.version}. Ready to sort.`);
            return true;
        } catch (error) {
            console.error('QSLManager: Boot failed:', error);
            return false;
        }
    },

    identify(callsign) {
        if (!this.prefixData) return null;
        let cleanCall = callsign.toUpperCase().trim();

        // Handle portable strokes (e.g., LA/G4ABC -> use LA)
        if (cleanCall.includes('/')) {
            const parts = cleanCall.split('/');
            cleanCall = (parts[0].length <= 3) ? parts[0] : (parts[1].length <= 3 ? parts[1] : parts[0]);
        }

        // Longest match search (4 chars down to 1)
        for (let i = 4; i >= 1; i--) {
            const searchPrefix = cleanCall.substring(0, i);
            for (const [countryName, data] of Object.entries(this.prefixData.countries)) {
                const pIndex = data.prefixes.indexOf(searchPrefix);
                if (pIndex !== -1) {
                    return {
                        country: countryName,
                        prefixIndex: pIndex, // Its position in the JSON array
                        hasBureau: data.hasQSLSortService
                    };
                }
            }
        }
        return null;
    },

    sortQSLs(qsoArray) {
        return qsoArray
            .map(qso => {
                const info = this.identify(qso.callsign);
                return {
                    ...qso,
                    _meta: info || { country: "ZZ_UNKNOWN", prefixIndex: 999, hasBureau: false }
                };
            })
            .sort((a, b) => {
                // 1. Bureau Status (Available first)
                if (a._meta.hasBureau !== b._meta.hasBureau) return a._meta.hasBureau ? -1 : 1;

                // 2. Country Name (Alphabetical A-Z)
                if (a._meta.country !== b._meta.country) {
                    return a._meta.country.localeCompare(b._meta.country);
                }

                // 3. Prefix Priority (Based on order in JSON array)
                if (a._meta.prefixIndex !== b._meta.prefixIndex) {
                    return a._meta.prefixIndex - b._meta.prefixIndex;
                }

                // 4. Callsign (Alphabetical fallback)
                return a.callsign.localeCompare(b.callsign);
            });
    }
};
