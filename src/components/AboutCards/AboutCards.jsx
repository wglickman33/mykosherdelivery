import "./AboutCards.scss";

const AboutCards = () => {
  const cards = [
    {
      title: "Save Time.",
      content: "Forget about crazy Friday traffic, wasting time finding parking in packed lots, and waiting on lines out the door. For the first time, skip the rush, order from My Kosher Delivery, and spend time on the important things!"
    },
    {
      title: "Save Money.",
      content: "So not only do you have to waste time driving and parking, but you also have to pay! Tolls and meters aren't the only things we're covering for you... We have a cheaper flat delivery fee than any other delivery service!"
    },
    {
      title: "Any Distance.",
      content: "We prioritize making kosher food more accessible when it's not. With delivery zones over 116 miles away, we deliver farther than anyone else! And yes... we keep your food in ice cold conditions to keep your food fresh and safe!"
    },
    {
      title: "One-Stop.",
      content: "With the ability to order from as many stores as you would like in a single order, we do all the shopping for you! No need to spend all day making dozens of stops. Just kick back, relax, and let us get it done for you!"
    }
  ];

  return (
    <div className="about-cards-container">
      <div className="about-cards-wrapper">
        {cards.map((card, index) => (
          <div key={index} className="about-card">
            <h3 className="about-card__title">{card.title}</h3>
            <p className="about-card__content">{card.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AboutCards;