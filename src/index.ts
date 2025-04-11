/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { object, string } from 'zod'
import { cors } from './config'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

//https://stackoverflow.com/a/75004138/5338829
interface Env {
	ACCESS_KEY_ID: string
	SECRET_ACCESS_KEY: string
	FORWARD: string
}

const sendEmail = async ({
	text,
	subject,
	email,
	env,
}: {
	text: string
	subject: string
	email: string | null
	env: Env
}) => {
	const client = new SESClient({
		region: 'us-east-1',
		credentials: {
			accessKeyId: env.ACCESS_KEY_ID,
			secretAccessKey: env.SECRET_ACCESS_KEY,
		},
	})
	try {
		await client.send(
			new SendEmailCommand({
				Source: 'feedback@filejedi.com',
				Destination: {
					ToAddresses: [env.FORWARD],
				},
				ReplyToAddresses: email ? [email] : [],
				Message: {
					Subject: {
						Data: subject, // Subject of the email
					},
					Body: {
						Text: {
							Data: text, // Plain text body
						},
					},
				},
			})
		)
	} catch (error) {
		console.error('Error sending email:', error)
	}
}

export default {
	async fetch(request, env) {
		if (request.method === 'OPTIONS') {
			// Handle CORS preflight request
			return new Response(null, {
				status: 204, // No Content
				headers: {
					'Access-Control-Allow-Origin': cors, // Allow all origins
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Allowed methods
					'Access-Control-Allow-Headers': 'Content-Type', // Allowed headers
					'Access-Control-Max-Age': '86400', // Cache preflight response for 1 day
				},
			})
		}

		if (
			request.method === 'POST' &&
			request.headers.get('Content-Type') === 'application/json'
		) {
			try {
				// Parse the JSON data from the request body
				const data = (await request.json()) as {
					subject: string
					message: string
					email: string | null
				}
				object({
					subject: string(),
					message: string(),
					email: string().email().nullable(),
				}).parse(data)

				await sendEmail({
					text: data.message,
					subject: data.subject,
					env,
					email: data.email,
				})

				// Respond back with some processed data or confirmation
				return new Response(
					JSON.stringify({
						message: 'Data received successfully',
						receivedData: data,
					}),
					{
						headers: {
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': cors,
						},
					}
				)
			} catch (error) {
				// Handle JSON parsing errors or other errors
				return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				})
			}
		} else {
			// Handle unsupported methods or content types
			return new Response(JSON.stringify({ error: 'Unsupported request' }), {
				status: 405,
				headers: { 'Content-Type': 'application/json' },
			})
		}
	},
} satisfies ExportedHandler<Env>
