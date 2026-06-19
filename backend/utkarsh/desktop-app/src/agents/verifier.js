function verify(step, result) {
    console.log(`[VERIFIER]: Checking result for ${step.action}...`);

    if (result === undefined || result === null) {
        console.warn(`[VERIFIER]: Step ${step.action} returned null/undefined result.`);
        return false;
    }

    if (Array.isArray(result) && result.length === 0) {
        console.warn(`[VERIFIER]: Step ${step.action} returned an empty array.`);
        return false;
    }

    if (typeof result === 'string' && result.trim() === "") {
        console.warn(`[VERIFIER]: Step ${step.action} returned an empty string.`);
        return false;
    }

    console.log(`[VERIFIER]: Step ${step.action} verified successfully.`);
    return true;
}

module.exports = { verify };
