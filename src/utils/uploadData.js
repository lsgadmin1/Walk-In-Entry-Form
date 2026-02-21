
const uploadData = async (formData, env) => {
    const apiUrl = `${import.meta.env.VITE_API_URL}/walk-in-entry/add`
    const apiKey = import.meta.env.VITE_API_KEY

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'x-environment': env
        },
        body: formData,
    })

    if (!response.ok) {
        console.error('Error uploading data:', response.status, response.statusText)
        return null
    }

    return response.json()
}

export default uploadData