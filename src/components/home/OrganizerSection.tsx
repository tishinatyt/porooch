import { Link } from 'react-router-dom'

const cards = [
  ['Створи подію за хвилину', 'Назва, дата, місце на карті — і подія вже в стрічці.'],
  ['Збери своїх людей', 'Подію побачать у стрічці та на карті міста. Учасники записуються в один клік і спілкуються в чаті події.'],
  ['Продавай квитки', 'Онлайн-оплата карткою, Apple Pay та Google Pay, схема залу з вибором місць, електронні квитки з QR-кодом і контроль входу.'],
] as const

export default function OrganizerSection() {
  return <section className="organizer-section" aria-label="Для організаторів">
    <p className="organizer-eyebrow">Для організаторів · Poruch.fun</p>
    <h2>Створюй свої події та продавай на них квитки разом з Poruch.fun</h2>
    <p className="organizer-intro">Зустріч, майстер-клас, концерт, стендап чи вечір настолок — розкажи про свою подію людям поруч.</p>
    <div className="organizer-tickets">{cards.map(([title, description], index) => <article className="organizer-ticket" key={title}>
      <div className="organizer-ticket-top">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {index === 0 ? <><rect x="8" y="11" width="32" height="30" rx="5"/><path d="M15 7v8m18-8v8M8 21h32M24 27v8m-4-4h8"/></> : index === 1 ? <><circle cx="24" cy="16" r="6"/><path d="M13 39v-5a11 11 0 0 1 22 0v5M9 14a5 5 0 0 0 0 10m30-10a5 5 0 0 1 0 10M5 37v-5a7 7 0 0 1 6-7m32 12v-5a7 7 0 0 0-6-7"/></> : <><path d="M7 13h34v8a4 4 0 0 0 0 8v8H7v-8a4 4 0 0 0 0-8zM29 13v5m0 5v4m0 5v5M13 21h9m-9 7h6"/></>}
        </svg>
        {index === 2 ? <span className="organizer-soon">Незабаром</span> : <span className="organizer-number">0{index + 1}</span>}
      </div>
      <h3>{title}</h3><p>{description}</p>
      <div className="organizer-perforation" aria-hidden="true">PORUCH / 0{index + 1}<span>✦</span></div>
    </article>)}</div>
    <Link className="organizer-cta" to="/create">Створити подію <span aria-hidden="true">↗</span></Link>
  </section>
}
