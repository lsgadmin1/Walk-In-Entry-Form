import { useEffect, useRef, useState } from 'react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import './App.css'
import uploadData from './utils/uploadData'

const initialValues = {
  fullName: '',
  phone: '91',
  email: '',
  photo: null,
  aadhaarPassport: null,
  gender: '',
  arrival: '',
  departure: '',
  members: '',
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
  } else if (values.fullName.trim().length < 3) {
    errors.fullName = 'Full name must be at least 3 characters.'
  } else if (values.fullName.trim().length > 30) {
    errors.fullName = 'Full name must not exceed 30 characters.'
  } else if (!/^[a-zA-Z\s]*$/.test(values.fullName.trim())) {
    errors.fullName = 'Full name must contain only alphabets and spaces.'
  }

  const phoneDigits = values.phone.trim()
  if (!phoneDigits || phoneDigits === '91') {
    errors.phone = 'Phone number is required.'
  } else if (!/^\d{10,15}$/.test(phoneDigits)) {
    errors.phone = 'Enter a valid phone number.'
  }

  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (!values.gender) errors.gender = 'Select a gender.'

  if (!values.departure) {
    errors.departure = 'Departure time is required.'
  } else {
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const [depDate, depTime] = values.departure.split('T')
    const [arrDate] = (values.arrival || '').split('T')
    if (depDate !== arrDate) {
      errors.departure = 'Departure date must be same as arrival date.'
    } else if (depTime <= currentTime) {
      errors.departure = 'Departure time must be greater than current time.'
    } else if (depTime >= '21:30') {
      errors.departure = 'Departure time must be before 09:30 PM.'
    }
  }

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
      if (!Number.isFinite(numericValue) || !Number.isInteger(numericValue) || numericValue < 0) {
        errors[field] = 'Enter a valid number.'
        return
      }
      total += numericValue
    })

    const hasGroupFieldErrors = groupFields.some((field) => errors[field])
    if (!hasGroupFieldErrors && total === 0) {
      errors.groupTotal = 'Provide at least one group member.'
    }
  }

  if (values.vehicles.length > 0) {
    const vehicleErrorsList = values.vehicles.map((vehicle) => {
      const vehicleErrors = {}
      if (!vehicle.number.trim()) vehicleErrors.number = 'Vehicle number is required.'
      else if (!VEHICLE_NUMBER_REGEX.test(vehicle.number.trim())) {
        vehicleErrors.number = 'Vehicle number must be 4-15 uppercase alphanumeric characters.'
      }
      if (!vehicle.type) vehicleErrors.type = 'Select a vehicle type.'
      return vehicleErrors
    })
    const hasVehicleErrors = vehicleErrorsList.some(
      (vehicleErrors) => Object.keys(vehicleErrors).length > 0,
    )
    if (hasVehicleErrors) errors.vehicles = vehicleErrorsList
  }

  if (values.vehicles.length > MAX_VEHICLES) {
    errors.vehiclesLimit = `You can add up to ${MAX_VEHICLES} vehicles only.`
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

const VEHICLE_NUMBER_REGEX = /^[A-Z0-9]{4,15}$/
const MAX_VEHICLES = 5
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024
const MAX_CAMERA_IMAGE_DIMENSION = 1600
const CAMERA_IMAGE_QUALITY = 0.82

const validateUploadFile = (file, fieldName) => {
  if (!file) return ''
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return 'File size must be less than 5 MB.'
  }

  if (fieldName === 'photo') {
    if (!file.type.startsWith('image/')) {
      return 'Visitor Photo must be an image file.'
    }
    return ''
  }

  if (fieldName === 'aadhaarPassport') {
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) {
      return 'Aadhaar / Passport must be an image or PDF file.'
    }
  }

  return ''
}

const loadImageElement = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to read selected image.'))
    }
    image.src = objectUrl
  })

const canvasToJpegBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to process image.'))
        return
      }
      resolve(blob)
    }, 'image/jpeg', quality)
  })

const compressImageFile = async (file, fileNamePrefix) => {
  if (!file.type.startsWith('image/')) {
    return file
  }

  const image = await loadImageElement(file)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, MAX_CAMERA_IMAGE_DIMENSION / Math.max(image.width, image.height))
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))

  const context = canvas.getContext('2d')
  if (!context) return file

  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  let quality = CAMERA_IMAGE_QUALITY
  let blob = await canvasToJpegBlob(canvas, quality)

  while (blob.size > MAX_UPLOAD_SIZE_BYTES && quality > 0.5) {
    quality -= 0.1
    blob = await canvasToJpegBlob(canvas, quality)
  }

  return new File([blob], `${fileNamePrefix}-${Date.now()}.jpg`, { type: 'image/jpeg' })
}


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
  const [aadhaarPassportPreview, setAadhaarPassportPreview] = useState('')
  const [aadhaarPassportPreviewType, setAadhaarPassportPreviewType] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraTarget, setCameraTarget] = useState('photo')
  const [cameraError, setCameraError] = useState('')
  const [fileErrors, setFileErrors] = useState({ photo: '', aadhaarPassport: '' })
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
  const aadhaarPassportCameraCaptureInputRef = useRef(null)
  const departureRef = useRef(null)

  const [env, setEnv] = useState('production')
  const [facingMode, setFacingMode] = useState('user')

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
    if (nextValues.gender === 'Male') updatedValues.men = '1'
    if (nextValues.gender === 'Female') updatedValues.women = '1'
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
      if (aadhaarPassportPreview) {
        URL.revokeObjectURL(aadhaarPassportPreview)
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [photoPreview, aadhaarPassportPreview, cameraStream])

  const handleChange = (event) => {
    const { name, value, type, files } = event.target
    const nextValue = type === 'file' ? files[0] || null : value

    if (type === 'file' && (name === 'photo' || name === 'aadhaarPassport')) {
      const validationError = validateUploadFile(nextValue, name)
      if (validationError) {
        setFileErrors((prev) => ({ ...prev, [name]: validationError }))
        event.target.value = ''
        return
      }
      setFileErrors((prev) => ({ ...prev, [name]: '' }))
    }

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

    if (name === 'aadhaarPassport') {
      if (aadhaarPassportPreview) {
        URL.revokeObjectURL(aadhaarPassportPreview)
      }
      setAadhaarPassportPreview(nextValue ? URL.createObjectURL(nextValue) : '')
      setAadhaarPassportPreviewType(nextValue ? nextValue.type || '' : '')
    }

    setValues(nextValues)

    if (touched[name]) {
      updateErrors(nextValues)
    }
  }

  const handleVehicleChange = (index, field, value) => {
    const nextValue =
      field === 'number'
        ? value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
        : value
    setValues((prev) => {
      const vehicles = prev.vehicles.map((vehicle, vehicleIndex) =>
        vehicleIndex === index ? { ...vehicle, [field]: nextValue } : vehicle,
      )
      const nextValues = { ...prev, vehicles }

      if (touchedVehicles[index]?.[field]) {
        updateErrors(nextValues)
      }

      return nextValues
    })
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
    if (values.vehicles.length >= MAX_VEHICLES) {
      return
    }

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
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
    }
    setCameraStream(null)
    setCameraOpen(false)
    setCameraTarget('photo')
    setFacingMode('user')
  }

  const openCamera = async (event, target = 'photo') => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    setCameraTarget(target)
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      const fallbackInput = target === 'aadhaarPassport'
        ? aadhaarPassportCameraCaptureInputRef.current
        : cameraCaptureInputRef.current
      if (fallbackInput) {
        fallbackInput.click()
        return
      }
      setCameraError('Unable to access camera in this browser. Try using HTTPS or a different browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
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
        setCameraError('No camera  was found on this device.')
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

  const flipCamera = async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
    }
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newFacingMode)
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      })
      setCameraStream(stream)
    } catch (error) {
      setCameraError('Unable to switch camera. Please try again.')
      setCameraStream(null)
      setCameraOpen(false)
    }
  }

  const capturePhoto = async (event) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const sourceWidth = video.videoWidth || 640
    const sourceHeight = video.videoHeight || 480
    const scale = Math.min(1, MAX_CAMERA_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight))
    canvas.width = Math.max(1, Math.round(sourceWidth * scale))
    canvas.height = Math.max(1, Math.round(sourceHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(async (blob) => {
      if (!blob) return
      try {
        const fileNamePrefix = cameraTarget === 'aadhaarPassport' ? 'aadhaar-or-passport' : 'visitor-photo'
        let file = new File([blob], `${fileNamePrefix}-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        })
        file = await compressImageFile(file, fileNamePrefix)
        const targetField = cameraTarget === 'aadhaarPassport' ? 'aadhaarPassport' : 'photo'
        const validationError = validateUploadFile(file, targetField)
        if (validationError) {
          setFileErrors((prev) => ({ ...prev, [targetField]: validationError }))
          stopCamera()
          return
        }
        setFileErrors((prev) => ({ ...prev, [targetField]: '' }))
        if (cameraTarget === 'aadhaarPassport') {
          if (aadhaarPassportPreview) {
            URL.revokeObjectURL(aadhaarPassportPreview)
          }
          setAadhaarPassportPreview(URL.createObjectURL(file))
          setAadhaarPassportPreviewType(file.type)
          setValues((prev) => ({ ...prev, aadhaarPassport: file }))
        } else {
          if (photoPreview) {
            URL.revokeObjectURL(photoPreview)
          }
          setPhotoPreview(URL.createObjectURL(file))
          setValues((prev) => ({ ...prev, photo: file }))
        }
        stopCamera()
      } catch (error) {
        const targetField = cameraTarget === 'aadhaarPassport' ? 'aadhaarPassport' : 'photo'
        setFileErrors((prev) => ({
          ...prev,
          [targetField]: 'Unable to process camera image. Please try again.',
        }))
        stopCamera()
      }
    }, 'image/jpeg', CAMERA_IMAGE_QUALITY)
  }

  const handleCameraCaptureFileChange = async (event) => {
    try {
      const selectedFile = event.target.files?.[0] || null
      if (!selectedFile) return
      const file = await compressImageFile(selectedFile, 'visitor-photo')
      const validationError = validateUploadFile(file, 'photo')
      if (validationError) {
        setFileErrors((prev) => ({ ...prev, photo: validationError }))
        event.target.value = ''
        return
      }
      setFileErrors((prev) => ({ ...prev, photo: '' }))
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      setPhotoPreview(URL.createObjectURL(file))
      setValues((prev) => ({ ...prev, photo: file }))
      event.target.value = ''
    } catch (error) {
      setFileErrors((prev) => ({
        ...prev,
        photo: 'Unable to process selected image. Please try again.',
      }))
      event.target.value = ''
    }
  }

  const handleAadhaarPassportCameraCaptureFileChange = async (event) => {
    try {
      const selectedFile = event.target.files?.[0] || null
      if (!selectedFile) return
      const file = selectedFile.type.startsWith('image/')
        ? await compressImageFile(selectedFile, 'aadhaar-or-passport')
        : selectedFile
      const validationError = validateUploadFile(file, 'aadhaarPassport')
      if (validationError) {
        setFileErrors((prev) => ({ ...prev, aadhaarPassport: validationError }))
        event.target.value = ''
        return
      }
      setFileErrors((prev) => ({ ...prev, aadhaarPassport: '' }))
      if (aadhaarPassportPreview) {
        URL.revokeObjectURL(aadhaarPassportPreview)
      }
      setAadhaarPassportPreview(URL.createObjectURL(file))
      setAadhaarPassportPreviewType(file.type || '')
      setValues((prev) => ({ ...prev, aadhaarPassport: file }))
      event.target.value = ''
    } catch (error) {
      setFileErrors((prev) => ({
        ...prev,
        aadhaarPassport: 'Unable to process selected file. Please try again.',
      }))
      event.target.value = ''
    }
  }

  const removePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoPreview('')
    setFileErrors((prev) => ({ ...prev, photo: '' }))
    setValues((prev) => ({ ...prev, photo: null }))
    // Clear file inputs
    const photoInput = document.querySelector('input[name="photo"]')
    if (photoInput) photoInput.value = ''
    if (cameraCaptureInputRef.current) {
      cameraCaptureInputRef.current.value = ''
    }
  }

  const removeAadhaarPassport = () => {
    if (aadhaarPassportPreview) {
      URL.revokeObjectURL(aadhaarPassportPreview)
    }
    setAadhaarPassportPreview('')
    setAadhaarPassportPreviewType('')
    setFileErrors((prev) => ({ ...prev, aadhaarPassport: '' }))
    setValues((prev) => ({ ...prev, aadhaarPassport: null }))
    const aadhaarPassportInput = document.querySelector('input[name="aadhaarPassport"]')
    if (aadhaarPassportInput) aadhaarPassportInput.value = ''
    if (aadhaarPassportCameraCaptureInputRef.current) {
      aadhaarPassportCameraCaptureInputRef.current.value = ''
    }
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
    if (values.aadhaarPassport) {
      submissionData.Aadhaar_or_Passport = values.aadhaarPassport
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
      setFileErrors({ photo: '', aadhaarPassport: '' })
      stopCamera()
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview)
      }
      setPhotoPreview('')
      if (aadhaarPassportPreview) {
        URL.revokeObjectURL(aadhaarPassportPreview)
      }
      setAadhaarPassportPreview('')
      setAadhaarPassportPreviewType('')
      setResetFormKey((prev) => prev + 1)
      // window.location.href = 'https://srimadhusudansai.com/'
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
            <button type="button" className="modal-button" onClick={closeModal}>
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
              <label htmlFor={`photo-${resetFormKey}`}>
                <span className="label">Visitor Photo</span>
              </label>
              <div className="file-input-wrapper">
                <input
                  id={`photo-${resetFormKey}`}
                  key={`photo-${resetFormKey}`}
                  type="file"
                  name="photo"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  accept="image/*"
                />
                <button type="button" className="file-input-icon-btn" onClick={(event) => openCamera(event, 'photo')} title="Open Camera" aria-label="Open Camera">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                </button>
              </div>
              <span className="helper">Supported formats: JPG, JPEG, PNG. <br></br>Max size: 5 MB.</span>
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
              {fileErrors.photo && <span className="error">{fileErrors.photo}</span>}
              {cameraError && <span className="error">{cameraError}</span>}
              {cameraOpen && (
                <div className="camera-modal-overlay">
                  <div className="camera-modal-content">
                    <div className="camera-preview">
                      <video ref={videoRef} autoPlay playsInline muted />
                      <canvas ref={canvasRef} className="hidden" />
                      <button
                        type="button"
                        className="flip-camera-btn"
                        onClick={flipCamera}
                        aria-label="Flip camera"
                        title="Switch camera"
                      >
                        🔄
                      </button>
                    </div>
                    <div className="camera-modal-actions">
                      <button type="button" className="primary-btn" onClick={capturePhoto}>
                        Capture Photo
                      </button>
                      <button type="button" className="ghost-btn" onClick={stopCamera}>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {photoPreview && (
                <div className="photo-preview">
                  <img src={photoPreview} alt="Captured visitor" />
                  <button
                    type="button"
                    className="remove-photo-btn"
                    onClick={removePhoto}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="field file-field">
              <label htmlFor={`aadhaarPassport-${resetFormKey}`}>
                <span className="label">Aadhaar / Passport</span>
              </label>
              <div className="file-input-wrapper">
                <input
                  id={`aadhaarPassport-${resetFormKey}`}
                  key={`aadhaarPassport-${resetFormKey}`}
                  type="file"
                  name="aadhaarPassport"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  accept="image/*,.pdf,application/pdf"
                />
                <button
                  type="button"
                  className="file-input-icon-btn"
                  onClick={(event) => openCamera(event, 'aadhaarPassport')}
                  title="Open Camera"
                  aria-label="Open Camera"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                </button>
              </div>
              <span className="helper">Supported formats: JPG, JPEG, PNG, PDF. <br></br>Max size: 5 MB.</span>
              <input
                ref={aadhaarPassportCameraCaptureInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleAadhaarPassportCameraCaptureFileChange}
                tabIndex={-1}
                aria-hidden="true"
              />
              {fileErrors.aadhaarPassport && <span className="error">{fileErrors.aadhaarPassport}</span>}
              {aadhaarPassportPreview && aadhaarPassportPreviewType.startsWith('image/') && (
                <div className="photo-preview">
                  <img src={aadhaarPassportPreview} alt="Captured Aadhaar or Passport" />
                  <button
                    type="button"
                    className="remove-photo-btn"
                    onClick={removeAadhaarPassport}
                    aria-label="Remove Aadhaar or Passport"
                  >
                    ×
                  </button>
                </div>
              )}
              {aadhaarPassportPreview && !aadhaarPassportPreviewType.startsWith('image/') && (
                <div className="file-preview">
                  {aadhaarPassportPreviewType === 'application/pdf' ? (
                    <iframe
                      src={aadhaarPassportPreview}
                      title="Aadhaar or Passport PDF preview"
                      className="pdf-preview"
                    />
                  ) : (
                    <span className="file-preview-name">{values.aadhaarPassport?.name || 'Aadhaar or Passport selected'}</span>
                  )}
                  <button
                    type="button"
                    className="remove-photo-btn"
                    onClick={removeAadhaarPassport}
                    aria-label="Remove Aadhaar or Passport"
                  >
                    ×
                  </button>
                </div>
              )}
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
                    value="Male"
                    checked={values.gender === 'Male'}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                  Male
                </label>
                <label>
                  <input
                    type="radio"
                    name="gender"
                    value="Female"
                    checked={values.gender === 'Female'}
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
                ref={departureRef}
                type="datetime-local"
                name="departure"
                value={values.departure}
                onChange={handleChange}
                onBlur={handleBlur}
                onClick={() => departureRef.current?.showPicker()}
                min={values.arrival || nowValue}
                max={values.arrival ? `${values.arrival.split('T')[0]}T21:30` : ''}
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
              <button
                type="button"
                className="ghost-btn"
                onClick={addVehicle}
                disabled={values.vehicles.length >= MAX_VEHICLES}
              >
                Add Vehicle
              </button>
            </div>
            {values.vehicles.length >= MAX_VEHICLES && (
              <span className="error">You can add up to {MAX_VEHICLES} vehicles only.</span>
            )}
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
                      placeholder="KA01AB1234"
                      maxLength={15}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      inputMode="text"
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
                      <option value="Two-Wheeler">Two-Wheeler</option>
                      <option value="Car">Car</option>
                      <option value="Auto Rickshaw">Auto Rickshaw</option>
                      <option value="Taxi / Cab">Taxi / Cab</option>
                      <option value="Van">Van</option>
                      <option value="Bus">Bus</option>
                      <option value="Mini Bus">Mini Bus</option>
                      <option value="Tractor">Tractor</option>
                      <option value="Construction Vehicle">Construction Vehicle</option>
                      <option value="Other">Other</option>
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
              setFileErrors({ photo: '', aadhaarPassport: '' })
              stopCamera()
              if (photoPreview) {
                URL.revokeObjectURL(photoPreview)
              }
              setPhotoPreview('')
              if (aadhaarPassportPreview) {
                URL.revokeObjectURL(aadhaarPassportPreview)
              }
              setAadhaarPassportPreview('')
              setAadhaarPassportPreviewType('')
              // Clear file inputs
              const photoInput = document.querySelector('input[name="photo"]')
              if (photoInput) photoInput.value = ''
              const aadhaarPassportInput = document.querySelector('input[name="aadhaarPassport"]')
              if (aadhaarPassportInput) aadhaarPassportInput.value = ''
              if (cameraCaptureInputRef.current) {
                cameraCaptureInputRef.current.value = ''
              }
              if (aadhaarPassportCameraCaptureInputRef.current) {
                aadhaarPassportCameraCaptureInputRef.current.value = ''
              }
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
