const MOOSEND_API_KEY = process.env.MOOSEND_API_KEY!;
const MOOSEND_MAILING_LIST_ID = process.env.MOOSEND_MAILING_LIST_ID!;

interface MoosendSubscriber {
  Email: string;
  Name: string;
  CustomFields?: string[];
}

export async function addSubscriberToMoosend(data: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  budget: string;
  appointmentDate: string;
}): Promise<{ success: boolean; error?: string }> {
  const subscriber: MoosendSubscriber = {
    Email: data.email,
    Name: `${data.firstName} ${data.lastName}`,
    CustomFields: [
      `Phone=${data.phone}`,
      `Budget=${data.budget}`,
      `AppointmentDate=${data.appointmentDate}`,
    ],
  };

  try {
    const res = await fetch(
      `https://api.moosend.com/v3/subscribers/${MOOSEND_MAILING_LIST_ID}/subscribe.json?apikey=${MOOSEND_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Subscribers: [subscriber] }),
      }
    );

    const json = await res.json();

    if (!res.ok || json.Code !== 0) {
      return { success: false, error: json.Error || "Moosend API error" };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
