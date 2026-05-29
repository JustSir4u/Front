import { useEffect, useMemo, useState } from 'react'
import './App.css'

const FALLBACK_MENU_ITEMS = [
  {
    id: 1,
    name: 'Paradicsomleves',
    price: 1190,
    category: 'leves',
    isWeekend: false,
  },
  {
    id: 2,
    name: 'Rántott sajt',
    price: 2490,
    category: 'főétel',
    isWeekend: true,
  },
]

const CATEGORY_OPTIONS = ['leves', 'előétel', 'főétel', 'desszert']

const EMPTY_FORM = {
  name: '',
  price: '',
  category: 'leves',
  isWeekend: false,
}

const normalizeCategory = (value) =>
  (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const getCategoryImage = (category) => {
  const normalized = normalizeCategory(category)

  if (normalized.includes('leves')) {
    return '/leves.svg'
  }

  if (normalized.includes('eloetel') || normalized.includes('eloe')) {
    return '/előétel.svg'
  }

  if (normalized.includes('foetel') || normalized.includes('foe')) {
    return '/főétel.svg'
  }

  return '/desszert.svg'
}

const normalizeMenuItems = (items) =>
  (Array.isArray(items) ? items : []).map((item, index) => ({
    id: item.id ?? item.itemId ?? index + 1,
    name: item.name ?? item.nev ?? 'Ismeretlen étel',
    price: Number(item.price ?? item.ar ?? 0),
    category: item.category ?? item.kategoria ?? 'desszert',
    isWeekend: Boolean(item.isWeekend ?? item.hetvegi),
  }))

const parseErrorMessages = (errorBody) => {
  if (!errorBody) {
    return ['Ismeretlen hiba történt.']
  }

  if (Array.isArray(errorBody)) {
    return errorBody.map((entry) => entry.toString())
  }

  if (typeof errorBody === 'string') {
    return [errorBody]
  }

  if (typeof errorBody === 'object') {
    if (errorBody.errors && typeof errorBody.errors === 'object') {
      return Object.entries(errorBody.errors).flatMap(([field, messages]) =>
        (Array.isArray(messages) ? messages : [messages]).map(
          (message) => `${field}: ${message}`,
        ),
      )
    }

    if (errorBody.message) {
      return [errorBody.message]
    }
  }

  return ['Sikertelen kérés.']
}

function App() {
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [usingFallbackData, setUsingFallbackData] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderMessages, setOrderMessages] = useState({})

  const sortedMenuItems = useMemo(
    () => [...menuItems].sort((a, b) => a.name.localeCompare(b.name, 'hu')),
    [menuItems],
  )

  const loadMenuItems = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/menuItems')

      if (!response.ok) {
        throw new Error('Nem sikerült lekérni az ételeket.')
      }

      const data = await response.json()
      setMenuItems(normalizeMenuItems(Array.isArray(data) ? data : data.items))
      setUsingFallbackData(false)
    } catch {
      setMenuItems(FALLBACK_MENU_ITEMS)
      setUsingFallbackData(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Petrik Étterem'
    void loadMenuItems()
  }, [])

  const onInputChange = (event) => {
    const { name, type, value, checked } = event.target
    setFormData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const onCreateMenuItem = async (event) => {
    event.preventDefault()
    setFormErrors([])
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/menuItems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          price: Number(formData.price),
          category: formData.category,
          isWeekend: formData.isWeekend,
        }),
      })

      if (!response.ok) {
        let errorBody = null
        try {
          errorBody = await response.json()
        } catch {
          errorBody = { message: 'Sikertelen létrehozás.' }
        }
        setFormErrors(parseErrorMessages(errorBody))
        return
      }

      setFormData(EMPTY_FORM)
      await loadMenuItems()
    } catch {
      setFormErrors(['Nem sikerült kapcsolódni a backend API-hoz.'])
    } finally {
      setIsSubmitting(false)
    }
  }

  const onOrder = async (itemId) => {
    try {
      const response = await fetch(`/api/menuItems/${itemId}/order`, {
        method: 'POST',
      })

      if (!response.ok) {
        let errorMessage = 'Sikertelen rendelés.'
        try {
          const errorBody = await response.json()
          errorMessage = parseErrorMessages(errorBody)[0] ?? errorMessage
        } catch {
          // no-op
        }

        setOrderMessages((previous) => ({
          ...previous,
          [itemId]: { type: 'error', text: errorMessage },
        }))
        return
      }

      setOrderMessages((previous) => ({
        ...previous,
        [itemId]: { type: 'success', text: 'Sikeres rendelés!' },
      }))
    } catch {
      setOrderMessages((previous) => ({
        ...previous,
        [itemId]: {
          type: 'error',
          text: 'Nem sikerült kapcsolódni a backend API-hoz.',
        },
      }))
    }
  }

  return (
    <>
      <header>
        <h1>Petrik Étterem</h1>
        <nav aria-label="Fő navigáció">
          <ul className="nav-list">
            <li>
              <a href="#etel-felvetele">Új étel</a>
            </li>
            <li>
              <a href="https://petrik.hu/" target="_blank" rel="noreferrer">
                Petrik honlapja
              </a>
            </li>
          </ul>
        </nav>
      </header>

      <main>
        <section aria-labelledby="etel-kinalat-cim">
          <h2 id="etel-kinalat-cim">Ételek</h2>
          {usingFallbackData && (
            <p className="info-message">
              A backend jelenleg nem elérhető, teszt adatok megjelenítése folyik.
            </p>
          )}
          {loading ? (
            <p>Betöltés...</p>
          ) : (
            <div className="menu-grid">
              {sortedMenuItems.map((item) => (
                <article
                  key={item.id}
                  className={`menu-card ${item.isWeekend ? 'weekend' : ''}`}
                >
                  <h3>{item.name}</h3>
                  <img
                    src={getCategoryImage(item.category)}
                    alt={`${item.category} kategória`}
                    className="category-image"
                  />
                  <p>
                    <strong>Ár:</strong> {item.price} Ft
                  </p>
                  <button type="button" onClick={() => void onOrder(item.id)}>
                    Rendelés
                  </button>
                  {orderMessages[item.id] && (
                    <p
                      className={`order-message ${orderMessages[item.id].type}`}
                      role="status"
                    >
                      {orderMessages[item.id].text}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="etel-felvetele" aria-labelledby="etel-felvetele-cim">
          <h2 id="etel-felvetele-cim">Étel felvétele</h2>
          <form onSubmit={onCreateMenuItem}>
            {formErrors.length > 0 && (
              <div className="error-panel" role="alert">
                <h3>Az étel rögzítése sikertelen:</h3>
                <ul>
                  {formErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <label htmlFor="name">Név</label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={onInputChange}
              required
            />

            <label htmlFor="price">Ár</label>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="1"
              value={formData.price}
              onChange={onInputChange}
              required
            />

            <label htmlFor="category">Kategória</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={onInputChange}
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <label htmlFor="isWeekend" className="checkbox-row">
              <input
                id="isWeekend"
                name="isWeekend"
                type="checkbox"
                checked={formData.isWeekend}
                onChange={onInputChange}
              />
              Hétvégi étel
            </label>

            <button type="submit" disabled={isSubmitting}>
              Új étel
            </button>
          </form>
        </section>
      </main>

      <footer>
        <p>Készítette: JustSir4u</p>
      </footer>
    </>
  )
}

export default App
