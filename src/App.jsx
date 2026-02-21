import { useEffect, useRef, useState } from 'react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import './App.css'
import uploadData from './utils/uploadData'

const initialValues = {
  fullName: '',
  phone: '',
  email: '',
  photo: null,
  gender: '',
  arrival: '',
  departure: '',
  members: 'single',
  men: '',
  women: '',
  boys: '',
  girls: '',
  vehicles: [],
}

const validate = (values) => {
  const errors = {}

  if (!values.fullName.trim()) {
    errors.fullName = 'Full name is required.'
  } else if (values.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.'
  }

  if (!values.phone.trim()) {
    errors.phone = 'Phone number is required.'
  } else if (!/^\d{6,15}$/.test(values.phone.trim())) {
    errors.phone = 'Enter a valid phone number.'
  }

  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!values.gender) errors.gender = 'Select a gender.'

  if (!values.departure) errors.departure = 'Departure date-time is required.'

  if (!values.members) errors.members = 'Select member type.'

  if (values.members === 'group') {
    const groupFields = ['men', 'women', 'boys', 'girls']
    let total = 0
    groupFields.forEach((field) => {
      const rawValue = values[field]
      if (rawValue === '') {
        errors[field] = 'Required for group.'
        return
      }
      const numericValue = Number(rawValue)
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        errors[field] = 'Enter a valid number.'
        return
      }
      total += numericValue
    })

    if (total === 0) {
      errors.groupTotal = 'Provide at least one group member.'
    }
  }

  const hasVehicleInput = values.vehicles.some(
    (vehicle) => vehicle.number.trim() || vehicle.type,
  )
  if (hasVehicleInput) {
    const vehicleErrorsList = values.vehicles.map((vehicle) => {
      const vehicleErrors = {}
      const hasInput = vehicle.number.trim() || vehicle.type
      if (!hasInput) return vehicleErrors
      if (!vehicle.number.trim()) vehicleErrors.number = 'Vehicle number is required.'
      else if (!VEHICLE_NUMBER_REGEX.test(vehicle.number.trim())) {
        vehicleErrors.number = 'Use format: KA 01 AB 1234'
      }
      if (!vehicle.type) vehicleErrors.type = 'Select a vehicle type.'
      return vehicleErrors
    })
    const hasVehicleErrors = vehicleErrorsList.some(
      (vehicleErrors) => Object.keys(vehicleErrors).length > 0,
    )
    if (hasVehicleErrors) errors.vehicles = vehicleErrorsList
  }

  return errors
}

const getNowDateTimeLocal = () => {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-') + `T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

const toTitleCase = (value) =>
  value
    .replace(/\s+/g, ' ')
    .trimStart()
    .split(' ')
    .map((word) =>
      word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : '',
    )
    .join(' ')

const formatZohoDateTime = (value) => {
  if (!value) return ''
  const [datePart, timePart] = value.split('T')
  if (!datePart || !timePart) return value
  const [year, month, day] = datePart.split('-')
  const [hour, minute] = timePart.split(':')
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const monthIndex = Number(month) - 1
  if (monthIndex < 0 || monthIndex > 11) return value
  return `${day}-${months[monthIndex]}-${year} ${hour}:${minute}`
}

const formatVehicleType = (value) => {
  if (!value) return ''
  if (value === 'two-wheeler') return 'Two Wheeler'
  return toTitleCase(value.replace(/-/g, ' '))
}

const formatVehicleNumber = (value) => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const match = cleaned.match(/^([A-Z]{0,2})(\d{0,2})([A-Z]{0,3})(\d{0,4}).*$/)
  if (!match) return ''
  const [, stateCode, districtCode, series, uniqueNumber] = match
  return [stateCode, districtCode, series, uniqueNumber].filter(Boolean).join(' ')
}

const VEHICLE_NUMBER_REGEX = /^[A-Z]{2} \d{1,2} [A-Z]{1,3} \d{4}$/


const buildFormData = (payload) => {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      formData.append(key, 'null')
      return
    }
    if (value instanceof File) {
      formData.append(key, value)
      return
    }
    if (Array.isArray(value) || typeof value === 'object') {
      formData.append(key, JSON.stringify(value))
      return
    }
    formData.append(key, String(value))
  })
  return formData
}

function App() {
  const nowValue = getNowDateTimeLocal()
  const [values, setValues] = useState(() => ({
    ...initialValues,
    arrival: nowValue,
  }))
  const [photoPreview, setPhotoPreview] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraStream, setCameraStream] = useState(null)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [touchedVehicles, setTouchedVehicles] = useState([])
  const [submitStatus, setSubmitStatus] = useState({ status: 'idle', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState({ type: 'success', title: '', message: '' })
  const [resetFormKey, setResetFormKey] = useState(0)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const cameraCaptureInputRef = useRef(null)

  const [env, setEnv] = useState('production')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const envParam = params.get('env')
    if (envParam === 'development' || envParam === 'stage') {
      setEnv(envParam)
    } else {
      setEnv('production')
    }
  }, [])

  const getEnvConfig = () => {
    switch (env) {
      case 'development':
        return { label: 'Development Mode', className: 'development' }
      case 'stage':
        return { label: 'Stage Mode', className: 'stage' }
      default:
        return { label: 'Production Mode', className: 'production' }
    }
  }

  const envConfig = getEnvConfig()

  const applySingleMemberCounts = (nextValues) => {
    if (nextValues.members !== 'single') return nextValues
    const updatedValues = {
      ...nextValues,
      men: '0',
      women: '0',
      boys: '0',
      girls: '0',
    }
    if (nextValues.gender === 'male') updatedValues.men = '1'
    if (nextValues.gender === 'female') updatedValues.women = '1'
    return updatedValues
  }

  const updateErrors = (nextValues) => {
    setErrors(validate(nextValues))
  }

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [photoPreview, cameraStream])

  const handleChange = (event) => {
    const { name, value, type, files } = event.target
    const nextValue = type === 'file' ? files[0] || null : value
    let nextValues = { ...values, [name]: nextValue }

    if (name === 'fullName') {
      nextValues.fullName = toTitleCase(nextValue)
    }

    if (name === 'members' && value === 'single') {
      nextValues = applySingleMemberCounts(nextValues)
    }

    if (name === 'members' && value === 'group') {
      nextValues.men = '0'
      nextValues.women = '0'
      nextValues.boys = '0'
      nextValues.girls = '0'
    }

    if (name === 'gender' && values.members === 'single') {
      nextValues = applySingleMemberCounts(nextValues)
    }

    if (name === 'photo') {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      setPhotoPreview(nextValue ? URL.createObjectURL(nextValue) : '')
    }

    setValues(nextValues)

    if (touched[name]) {
      updateErrors(nextValues)
    }
  }

  const handleVehicleChange = (index, field, value) => {
    const nextValue = field === 'number' ? formatVehicleNumber(value) : value
    const vehicles = values.vehicles.map((vehicle, vehicleIndex) =>
      vehicleIndex === index ? { ...vehicle, [field]: nextValue } : vehicle,
    )
    const nextValues = { ...values, vehicles }
    setValues(nextValues)

    if (touchedVehicles[index]?.[field]) {
      updateErrors(nextValues)
    }
  }

  const handleVehicleBlur = (index, field) => {
    setTouchedVehicles((prev) =>
      prev.map((vehicle, vehicleIndex) =>
        vehicleIndex === index ? { ...vehicle, [field]: true } : vehicle,
      ),
    )
    updateErrors(values)
  }

  const addVehicle = () => {
    setValues((prev) => ({
      ...prev,
      vehicles: [...prev.vehicles, { number: '', type: '' }],
    }))
    setTouchedVehicles((prev) => [...prev, { number: false, type: false }])
  }

  const removeVehicle = (index) => {
    const vehicles = values.vehicles.filter((_, vehicleIndex) => vehicleIndex !== index)
    setValues((prev) => ({ ...prev, vehicles }))
    setTouchedVehicles((prev) => prev.filter((_, vehicleIndex) => vehicleIndex !== index))
    updateErrors({ ...values, vehicles })
  }

  const handleBlur = (event) => {
    const { name } = event.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    updateErrors(values)
  }

  const handlePhoneChange = (value) => {
    const nextValues = { ...values, phone: value }
    setValues(nextValues)
    if (touched.phone) {
      updateErrors(nextValues)
    }
  }

  const handlePhoneBlur = () => {
    setTouched((prev) => ({ ...prev, phone: true }))
    updateErrors(values)
  }

  const stopCamera = (event) => {
    if (event) event.stopPropagation()
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
    }
    setCameraStream(null)
    setCameraOpen(false)
  }

  const openCamera = async (event) => {
    if (event) event.stopPropagation()
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      if (cameraCaptureInputRef.current) {
        cameraCaptureInputRef.current.click()
        return
      }
      setCameraError('Unable to access camera in this browser. Try using HTTPS or a different browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      setCameraStream(stream)
      setCameraOpen(true)
    } catch (error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow access and try again.')
        return
      }
      if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        setCameraError('No camera device was found on this phone.')
        return
      }
      if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        setCameraError('Camera is currently in use by another app. Close it and try again.')
        return
      }
      if (error?.name === 'SecurityError') {
        setCameraError('Camera access requires a secure connection (HTTPS).')
        return
      }
      setCameraError('Unable to start camera. Please try again.')
    }
  }

  const capturePhoto = (event) => {
    if (event) event.stopPropagation()
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `visitor-photo-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      })
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      setPhotoPreview(URL.createObjectURL(file))
      setValues((prev) => ({ ...prev, photo: file }))
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  const handleCameraCaptureFileChange = (event) => {
    const file = event.target.files?.[0] || null
    if (!file) return
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoPreview(URL.createObjectURL(file))
    setValues((prev) => ({ ...prev, photo: file }))
    event.target.value = ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)
    setTouched({
      fullName: true,
      phone: true,
      email: true,
      gender: true,
      departure: true,
      members: true,
      men: true,
      women: true,
      boys: true,
      girls: true,
    })
    setTouchedVehicles(
      values.vehicles.map(() => ({ number: true, type: true })),
    )

    if (Object.keys(validationErrors).length > 0) {
      setModalData({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fix the highlighted fields and try again.',
      })
      setShowModal(true)
      return
    }

    setIsSubmitting(true)

    const vehiclesInfo = values.vehicles
      .filter((vehicle) => vehicle.number.trim() || vehicle.type)
      .map((vehicle) => ({
        Vehicle_Number: vehicle.number.trim(),
        Vehicle_Type: formatVehicleType(vehicle.type),
      }))

    const submissionData = {
      Full_Name: values.fullName.trim(),
      Phone_Number: values.phone ? `+${values.phone}` : '',
      Gender: values.gender,
      Expected_Arrival_Date_Time: formatZohoDateTime(getNowDateTimeLocal()),
      Expected_Departure_Date_Time: formatZohoDateTime(values.departure),
      Number_of_Men: values.men,
      Number_of_Women: values.women,
      Number_of_Boys: values.boys,
      Number_of_Girls: values.girls,
    }

    submissionData.Email = values.email.trim() || null
    submissionData.Vehicles_Information = vehiclesInfo.length > 0 ? vehiclesInfo : null
    if (values.photo) {
      submissionData.Visitor_s_Photo = values.photo
    }

    try {

      console.log('Submission payload:', submissionData)
      
      const response = await uploadData(buildFormData(submissionData), env)

      if (!response) {
        setModalData({
          type: 'error',
          title: 'Submission Error',
          message: 'There was an error submitting the form. Please try again later.',
        })
        setShowModal(true)
        setIsSubmitting(false)
        return
      }

      setModalData({
        type: 'success',
        title: 'Success!',
        message: 'Walk-In Registration successfully submitted.',
      })
      setShowModal(true)
      setIsSubmitting(false)

    } catch (error) {
      setModalData({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred. Please try again later.',
      })
      setShowModal(true)
      setIsSubmitting(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    if (modalData.type === 'success') {
      const nextNow = getNowDateTimeLocal()
      const resetValues = { ...initialValues, arrival: nextNow }
      setValues(resetValues)
      setErrors({})
      setTouched({})
      setTouchedVehicles([])
      setCameraError('')
      stopCamera()
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      setPhotoPreview('')
      setResetFormKey((prev) => prev + 1)
    }
  }

  const showError = (field) => touched[field] && errors[field]
  const showVehicleError = (index, field) =>
    touchedVehicles[index]?.[field] && errors.vehicles?.[index]?.[field]

  return (
    <div className="page">
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-icon ${modalData.type}`}>
              {modalData.type === 'success' ? '✓' : '!'}
            </div>
            <h2 className="modal-title">{modalData.title}</h2>
            <p className="modal-message">{modalData.message}</p>
            <button className="modal-button" onClick={closeModal}>
              {modalData.type === 'success' ? 'Done' : 'OK'}
            </button>
          </div>
        </div>
      )}
      <form className="form-card" onSubmit={handleSubmit} noValidate>

        <header className="hero">
          <div>
            <h1>Visitor Entry Form</h1>
            <p className="eyebrow">Walk-In Registration</p>
          </div>
          {env !== 'production' && (
            <div
              className={`env-pill ${envConfig.className}`}
              aria-label={envConfig.label}
              title={envConfig.label}
            >
              <span className="env-dot" aria-hidden="true" />
              <span className="env-text">{envConfig.label}</span>
            </div>
          )}
        </header>

        <section className="form-section">
          <div className="section-title">
            <h2>Visitor Details</h2>
            <p>Basic identity details and contact information.</p>
          </div>
          <div className="form-grid two-col">
            <label className="field">
              <span className="label">
                Full Name <span className="required">*</span>
              </span>
              <input
                type="text"
                name="fullName"
                value={values.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter full name"
                aria-invalid={Boolean(showError('fullName'))}
              />
              {showError('fullName') && <span className="error">{errors.fullName}</span>}
            </label>

            <label className="field">
              <span className="label">
                Phone Number <span className="required">*</span>
              </span>
              <PhoneInput
                key={`phone-${resetFormKey}`}
                country="in"
                value={values.phone}
                onChange={handlePhoneChange}
                onBlur={handlePhoneBlur}
                inputProps={{
                  name: 'phone',
                  required: true,
                  autoComplete: 'tel',
                  'aria-invalid': Boolean(showError('phone')),
                }}
              />
              {showError('phone') && <span className="error">{errors.phone}</span>}
            </label>

            <label className="field">
              <span className="label">Email</span>
              <input
                type="email"
                name="email"
                value={values.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="name@example.com"
                aria-invalid={Boolean(showError('email'))}
              />
              {showError('email') && <span className="error">{errors.email}</span>}
            </label>

            <div className="field file-field">
              <label>
                <span className="label">Visitor Photo</span>
                <input
                  type="file"
                  name="photo"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  accept="image/*"
                />
              </label>
              <input
                ref={cameraCaptureInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleCameraCaptureFileChange}
                tabIndex={-1}
                aria-hidden="true"
              />
              <div className="photo-actions">
                <button type="button" className="ghost-btn" onClick={openCamera}>
                  Open Camera
                </button>
                {cameraOpen && (
                  <button type="button" className="primary-btn" onClick={capturePhoto}>
                    Capture Photo
                  </button>
                )}
                {cameraOpen && (
                  <button type="button" className="link-btn" onClick={stopCamera}>
                    Close Camera
                  </button>
                )}
              </div>
              {cameraError && <span className="error">{cameraError}</span>}
              {cameraOpen && (
                <div className="camera-preview">
                  <video ref={videoRef} autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}
              {photoPreview && (
                <div className="photo-preview">
                  <img src={photoPreview} alt="Captured visitor" />
                </div>
              )}
              <span className="helper">Upload a clear headshot (optional).</span>
            </div>
          </div>

          <div className="form-grid">
            <fieldset className="field radio-group">
              <legend className="label">
                Gender <span className="required">*</span>
              </legend>
              <div className="radio-options">
                <label>
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={values.gender === 'male'}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                  Male
                </label>
                <label>
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={values.gender === 'female'}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                  Female
                </label>
              </div>
              {showError('gender') && <span className="error">{errors.gender}</span>}
            </fieldset>
          </div>
        </section>

        <section className="form-section">
          <div className="section-title">
            <h2>Visit Schedule</h2>
            <p>Expected departure date-time.</p>
          </div>
          <div className="form-grid">
            <label className="field">
              <span className="label">
                Expected Departure Date-Time <span className="required">*</span>
              </span>
              <input
                type="datetime-local"
                name="departure"
                value={values.departure}
                onChange={handleChange}
                onBlur={handleBlur}
                min={nowValue}
                aria-invalid={Boolean(showError('departure'))}
              />
              {showError('departure') && <span className="error">{errors.departure}</span>}
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="section-title">
            <h2>Members</h2>
            <p>Let us know if this is a single visitor or a group.</p>
          </div>
          <div className="form-grid">
            <fieldset className="field radio-group">
              <legend className="label">
                Members <span className="required">*</span>
              </legend>
              <div className="radio-options">
                <label>
                  <input
                    type="radio"
                    name="members"
                    value="single"
                    checked={values.members === 'single'}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                  Single
                </label>
                <label>
                  <input
                    type="radio"
                    name="members"
                    value="group"
                    checked={values.members === 'group'}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                  Group
                </label>
              </div>
              {showError('members') && <span className="error">{errors.members}</span>}
              {errors.groupTotal && values.members === 'group' && (
                <span className="error">{errors.groupTotal}</span>
              )}
            </fieldset>
          </div>

          {values.members === 'group' && (
            <div className="form-grid four-col">
              <label className="field">
                <span className="label">Number of Men</span>
                <input
                  type="number"
                  name="men"
                  value={values.men}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  min="0"
                  placeholder="0"
                  aria-invalid={Boolean(showError('men'))}
                />
                {showError('men') && <span className="error">{errors.men}</span>}
              </label>
              <label className="field">
                <span className="label">Number of Women</span>
                <input
                  type="number"
                  name="women"
                  value={values.women}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  min="0"
                  placeholder="0"
                  aria-invalid={Boolean(showError('women'))}
                />
                {showError('women') && <span className="error">{errors.women}</span>}
              </label>
              <label className="field">
                <span className="label">Number of Boys</span>
                <input
                  type="number"
                  name="boys"
                  value={values.boys}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  min="0"
                  placeholder="0"
                  aria-invalid={Boolean(showError('boys'))}
                />
                {showError('boys') && <span className="error">{errors.boys}</span>}
              </label>
              <label className="field">
                <span className="label">Number of Girls</span>
                <input
                  type="number"
                  name="girls"
                  value={values.girls}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  min="0"
                  placeholder="0"
                  aria-invalid={Boolean(showError('girls'))}
                />
                {showError('girls') && <span className="error">{errors.girls}</span>}
              </label>
            </div>
          )}
        </section>

        <section className="form-section">
          <div className="section-title">
            <div className="section-header">
              <div>
                <h2>Vehicle Details</h2>
                <p>Vehicle information for entry management.</p>
              </div>
              <button type="button" className="ghost-btn" onClick={addVehicle}>
                Add Vehicle
              </button>
            </div>
          </div>

          <div className="vehicle-list">
            {values.vehicles.map((vehicle, index) => (
              <div className="vehicle-card" key={`vehicle-${index}`}>
                <div className="vehicle-head">
                  <span className="vehicle-title">Vehicle {index + 1}</span>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => removeVehicle(index)}
                  >
                    Remove
                  </button>
                </div>
                <div className="form-grid two-col">
                  <label className="field">
                    <span className="label">
                      Vehicle Number <span className="required">*</span>
                    </span>
                    <input
                      type="text"
                      name={`vehicleNumber-${index}`}
                      value={vehicle.number}
                      onChange={(event) =>
                        handleVehicleChange(index, 'number', event.target.value)
                      }
                      onBlur={() => handleVehicleBlur(index, 'number')}
                      placeholder="KA 01 AB 1234"
                      aria-invalid={Boolean(showVehicleError(index, 'number'))}
                    />
                    {showVehicleError(index, 'number') && (
                      <span className="error">{errors.vehicles[index].number}</span>
                    )}
                  </label>
                  <label className="field">
                    <span className="label">
                      Vehicle Type <span className="required">*</span>
                    </span>
                    <select
                      name={`vehicleType-${index}`}
                      value={vehicle.type}
                      onChange={(event) =>
                        handleVehicleChange(index, 'type', event.target.value)
                      }
                      onBlur={() => handleVehicleBlur(index, 'type')}
                      aria-invalid={Boolean(showVehicleError(index, 'type'))}
                    >
                      <option value="">Select</option>
                      <option value="two-wheeler">Two Wheeler</option>
                      <option value="car">Car</option>
                      <option value="auto-rickshaw">Auto Rickshaw</option>
                      <option value="truck">Truck</option>
                      <option value="taxi/cab">Taxi / Cab</option>
                      <option value="van">Van</option>
                      <option value="bus">Bus</option>
                      <option value="mini-bus">Mini Bus</option>
                      <option value="tractor">Tractor</option>
                      <option value="construction-vehicle">Construction Vehicle</option>
                      <option value="other">Other</option>
                    </select>
                    {showVehicleError(index, 'type') && (
                      <span className="error">{errors.vehicles[index].type}</span>
                    )}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" className="primary-btn" disabled={isSubmitting}>
            <div className="submit-btn-content">
              {isSubmitting && <div className="spinner"></div>}
              {isSubmitting ? 'Submitting...' : 'Submit Registration'}
            </div>
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              const nextNow = getNowDateTimeLocal()
              setValues({ ...initialValues, arrival: nextNow })
              setErrors({})
              setTouched({})
              setTouchedVehicles([])
              setCameraError('')
              stopCamera()
              if (photoPreview) {
                URL.revokeObjectURL(photoPreview)
              }
              setPhotoPreview('')
            }}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  )
}

export default App
